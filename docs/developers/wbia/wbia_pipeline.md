---
id: wbia_pipeline
title: WBIA Detection Pipeline
sidebar_label: Detection Pipeline
---

This documentation presents a unified pipeline of modular machine learning (ML) components that detect, classify, and otherwise prepare images of animals for use in a visual identification (ID) procedure.

## Overview of Detection for Animal ID

The computer vision task of object detection includes the inherent step of finding animals in images but, when used as a prerequisite for animal ID, it needs to be able to do much more than just that. For example, animal detection needs to determine an animal's species and viewpoint so that automated tools consider only annotations that can actually be compared; having ecological metadata like species and viewpoint increases the accuracy and speed of ID by filtering out annotations that could only function as potential confusers. An annotation may also need to be rotated to allow accurate matching or have its background segmented out because it is distracting for algorithms or humans. What is needed is a comprehensive pipeline that can perform a variety of different "detection" tasks on animals so that an automated ID process can focus on its tasks of describing, retrieving, ranking, and verifying potential matches in a catalog. The use case of automated animal detection for ID motivates all of the machine learning decisions at Wild Me, and it is important to understand them thoroughly prior to training new models.

The animal detection problem can be exceedingly complex: there may be multiple (or no) animals from several different species in an image, some species might not be the target of ID but have a similar visual appearance to the species of interest, some annotations may have poor quality while others may show only parts of the animal, or an animal may be occluded by other animals or vegetation. Furthermore, animals may be seen from various scales, viewpoints, and poses, only some showing identifiable information. The images provided to the detection pipeline may also originate from handheld cameras used by trained ecologists or novices (e.g., tourists, children) with no prior experience taking photos of animals for photographic ID. Images can also be captured by passive collection devices like a camera-trap or an aerial surveying platform. The detection pipeline must account for these challenges and automate the creation of high-quality annotations useful for animal ID or wide-area aerial counts.

### WBIA Detection Pipeline

![Overview of Detection Pipeline](../../../static/img/wbia_pipeline.jpg)

In response to the challenges outlined above, the Wildbook Image Analysis (WBIA) software suite offers a multi-stage detection pipeline solution (diagramed above). The components are, in order of their intended usage in the detection pipeline, the following:

1. whole-image classification to select the images that contain desired species or are otherwise relevant to the analysis,
2. bounding-box localization to form annotations,
3. annotation classification (labeler) to predict the animal's species and viewpoint,
4. coarse annotation segmentation to eliminate irrelevant background information, and
5. **[DEPRICATED]** a classifier to select the "Annotation(s) of Interest" as the most prominent animal(s) in the image.

Beyond these core detection components, there are also the following additional components that are handy for automated ID pipelines:

1. bounding-box orientation to apply an orientation to a pre-existing, axis-aligned annotation
2. body bounding-box to part bounding-box assignment

This documentation describes how each component is configured, trained, and deployed for new species in WBIA.  The reader is suggested to already be familiar with the [overview of the WBIA software](wbia_overview.md) and [its plug-ins](wbia_plugins.md) prior to reading and using this documentation.  For simplicity, the Annotation of Interest (AoI) pipeline component has been deprecated because it has been replaced with a newer and more accurate concept; the replacement is not covered in this documentation either because it is not used in practice on Wildbook or Codex projects, and is instead used for dedicated censusing events like the Great Grevy's Rally (GGR).  For more information on Census Annotation (CA) and Census Annotation Regions (CA-R), the reader is directed to read Chapter 5 of the dissertation mentioned in the comment below.

*The above introduction and some of the content of this page have been adapted from the dissertation "Animal Detection for Photographic Censusing" by Dr. Jason Parham, the original author of this content.  The concepts of Annotation of Interest (AoI) and its replacement - Census Annotation (CA) and Census Annotation Regions (CA-R) - can be read about there.*

### TL;DR

The instructions below give examples of how to train each component, using a variety of species to showcase the various features of each component.  The species in this tutorial will include Beluga whales, giraffes, and the Scout project as prototypes.  If you would like to see an end-to-end example, consult the final section of the Conclusion section at the bottom of these instructions.

In general, all of the models have pre-specified hyperparameters for the initial learning rate, learning rate scheduler (patience-based plateau), optimizer (SGD + Momentum), stopping criteria (validation-based early stopping), batch size, feature extraction backbone (DenseNet 201), pre-trained model weights (transfer learning from PyTorch model zoo), random initialization, other parameters for intermediate result caching, and the amount of model ensembling.  The settings have been selected to optimize the training on a single GPU with around 8GB of available memory.  Data augmentation (with the ``imgaug`` Python package) is also specified for each algorithm as a recommended set of modifications to ensure the model does not substantially overfit; the data loaders used by the classifier and labeler models are designed to sample the number of examples for each epoch as a multiple of the least frequent class.  For example, if if the labeler is trained on species and viewpoints and one class has only 8 examples, then the epoch's dataset is built by randomly sampling each class to have a maximum of 32 classes (balancing the set with a default multipler of 4.0).

The paramters and settings may be changed, as needed, in the respective training code located in various files within the ``wbia/algo/detect/`` submodule.  Most of the parameters and designs are not exposed by the Python API, so code modifications are required prior to training.  In general, the default settings require very little modification to train a working model.  The settings may need to be adjusted for memory use on a particular GPU (e.g., batch size), but the default settings are recommended for reliably training models with minimal divergence.

## Creating a WBIA Database

Before we begin talking about how to train new ML models, we must first talk about how the data should be stored and how the training scripts will access it from a WBIA database.  A WBIA database, at its core, is simply a special folder on the local file system. WBIA uses SQLite3 and subfolders for all of its database and asset storage, and can be reviewed here: [overview of the WBIA software](wbia_overview.md).  When a WBIA database is loaded into a controller object, it is accessed using a Python API.

### Starting a WBIA Docker container

The easiest way to open a WBIA database is to use Docker, with the following commands:

```bash
# Install tmux (or screen)
sudo apt install tmux

# Create a holding folder
cd ~/
mkdir -p $(pwd)/wbia
cd $(pwd)/wbia

# copy import data into $(pwd)/wbia/import/

# Setup environment file for permissions
echo """
HOST_UID=$(id -u)
HOST_USER=$(whoami)
""" > $(pwd)/wbia.env

# Launch Docker container
docker run \
    -d \
    -p 5000:5000 \
    --gpus '"device=0,1"' \
    --shm-size=2g \
    --name wbia.ggr \
    -v $(pwd)/db:/data/db \
    -v $(pwd)/cache:/cache \
    -v $(pwd)/import:/data/import \
    --env-file $(pwd)/wbia.env \
    --restart unless-stopped \
    wildme/wbia:develop \
        --container-name wbia.ggr \
        --lca \
        --engine-slow-lane-workers 0 \
        --engine-fast-lane-workers 0

# Docker container logging
docker logs --follow wbia.ggr

# iPython embed interactive session inside Docker container
tmux new-session -s wbia.ggr

# Exec into the Docker container and start bash
<tmux>$ docker exec -it wbia.ggr bash

# Load the WBIA database
<container>$ embed
```

The above `embed` command will place you into an iPython shell with a WBIA controller `ibs` already loaded in the local variable space and attached to the database `/data/db` within the Docker container.

### Making a WBIA controller

Alternatively, the WBIA controller can be loaded from source by running the code below:

``` python
import wbia

ibs = wbia.opendb('/path/to/database')
```

### Adding images to a WBIA database

All of the training scripts in the following sections will rely on having access to a WBIA controller object `ibs` and a database of images and annotations.  The controller offers all of the standard CRUD modules to add, get, set, and delete objects within the database.  The images can be added manually with Python or REST APIs, and the WBIA web interface can be used to annotate ground-truth bounding boxes.  Newly created annotations can also be added manually with Python or REST APIs, in addition to the web interface.  There are also additional web interfaces for reviewing annotations and adding relevant metadata for species, viewpoints, and other ground-truth attributes needed for animal ID.  To do this manually, for example, you can use the following code:

``` python
import wbia

ibs = wbia.opendb('/path/to/database')

image_paths = ['/path/to/image1.jpg', '/path/to/image2.png']
# Returns a list of two integer rowids, corresponding to the list of image
# paths that were passed in as input
gids = ibs.add_images(image_paths)

# Returns a list of two integer rowids
# bounding boxes are specified as (xtl, ytl, w, h) in real pixel terms
aids = ibs.add_annots(gids, [(0, 10, 100, 400), (0, 10, 100, 400)])

# Sets the annotation species metadata
ibs.set_annot_species(aids, ['new_species'] * len(aids))
```

Once a dataset of ground-truthed images and annotations exists in the WBIA database, training for the various components can begin.  The required amounts of training examples for each component varies, but in general the pipeline requires 2,000 ground-truth images with all animals annotated with bounding boxes, parts, species, and viewpoints.  When annotating ground-truth training data, special attention should be paid to appropriately sample all of the expected variance to be seen during real-world use.  For example, if the training dataset is to be used for daytime and Infrared (IR) imagery, it is advised that the training data is balanced equally for both of these conditions.  Likewise, if the detection dataset is to be used for ID training, it is recommended that the population is sampled as uniformly for as many individuals as possible.  In practice, we recommend including three to five images of each individual in the dataset, if possible, with a minimum of one day between sightings for the same individual.

To add images to a database in bulk from a folder, there is a handy function on the IBEIS controller that will recursively search a folder for new images and add them to the database.

``` python
# The path is the location within the Docker container, which is mapped to a
# host folder on launch
gids = ibs.import_folder('/data/import')

# Get the original paths of the images that were imported
image_paths = ibs.get_image_uris_original(gids)
```

### Making Train/Test Sets

Lastly, the dataset needs to be split between a training set and a testing set.  The split between train and test is automatically determined by taking each image in the entire dataset and splitting it randomly as 80% for training and 20% for testing.  The validation set is taken from the training set, as determined by each component individually.  Running the following Python code will create the initial split and add the images into two imagesets called `TRAIN_SET` and `TEST_SET`:

``` python
ibs.imageset_train_test_split()
```

### Visualizing Data Distributions

Once images and annotations have been added to the WBIA database, and training and testing imagesets have been created, we can look at the state of the database and list out the types and quantities of annotations.  Below is an example with a WBIA database of adult Beluga whales and their calves.

``` python
import utool as ut

species_list = [
    'whale_beluga',
    'whale_beluga_calf',
]

species_mapping = {}

viewpoint_mapping = {
    'whale_beluga': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    },
    'whale_beluga_calf': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    }
}
```

With the above species and mappings for viewpoints, we can print out the current stats of the database:

``` python
# Get all images, their annotations, and their metadata
gid_list = ibs.get_valid_gids()
aid_list = ut.flatten(ibs.get_image_aids(gid_list))
annot_gid_list = ibs.get_annot_gids(aid_list)
annot_species_list = ibs.get_annot_species(aid_list)
annot_viewpoint_list = ibs.get_annot_viewpoints(aid_list)

# Construct a histogram of all species and their viewpoints
hist_dict = {}
zipped = zip(aid_list, annot_gid_list, annot_species_list, annot_viewpoint_list)
for aid, annot_gid, species, viewpoint in zipped:
    if species not in species_list:
        continue
    if species not in hist_dict:
        hist_dict[species] = {}
    viewpoint = viewpoint_mapping[species].get(viewpoint, viewpoint)
    viewpoint_ = '%s:%s' % (species, viewpoint)
    if viewpoint is None:
        continue
    if viewpoint not in hist_dict[species]:
        hist_dict[species][viewpoint] = 0
    hist_dict[species][viewpoint] += 1

# Print out
print(ut.repr3(hist_dict))
```

It is very important to understand the underlying distribution of species and viewpoints in your dataset.  Special care should be paid to combining multiple species or viewpoints into a single category if there is not a sufficient number of total examples.  In the above example with Beluga whales, we can see that the ground-truth annotators labeled annotations with the viewpoints `left`, `frontleft`, `backleft`, and `upleft`.  When the annotation labeler is trained, however, we map all of these viewpoints into the single combined label of `left`.  The benefit of this mapping is accuracy in assigning ground-truth labels, but then flexibility when the ML model is trained to predict a more robust category with a sufficient number of examples.  Similarly, any viewpoint mapping that ends with `None` is ignored by the training code.  This allows certain species+viewpoint categories (e.g., `whale_beluga_calf:front`) to be omitted during ML training because there are too few examples overall.

### Adding Parts as Annotations

Many of the ML components and training scripts in WBIA were designed prior to the introduction of annotation parts to the system.  Furthermore, many of the standard off-the-shelf algorithms for object detection do not include the concept of hierarchical detections of bounding boxes (let alone rotated bounding boxes).  To address this when parts are needed for detection and labeler training, we must convert all parts into corresponding annotations with the same dimensions.  This is done as a temporary process and is only used during the training setup and evaluation.

```python
# Get all parts
gid_list = ibs.get_valid_gids()
aid_list = ut.flatten(ibs.get_image_aids(gid_list))
part_rowid_list = ut.flatten(ibs.get_annot_part_rowids(aid_list))

# Get part metadata
part_parent_aid_list = ibs.get_part_aids(part_rowid_list)
part_parent_gid_list = ibs.get_annot_gids(part_parent_aid_list)
part_bbox_list = ibs.get_part_bboxes(part_rowid_list)
part_theta_list = ibs.get_part_thetas(part_rowid_list)
part_species_list = ibs.get_annot_species(part_parent_aid_list)
part_viewpoint_list = ibs.get_annot_viewpoints(part_parent_aid_list)
part_type_list = ibs.get_part_types(part_rowid_list)

# Set new annotation's species based on parent species and part type
# (separated by a + character)
part_new_species_list = [
    '%s+%s' % (species, type_, )
    for species, type_ in zip(part_species_list, part_type_list)
]
part_note_list = ['TEMPORARY'] * len(part_parent_gid_list)

# Add annotations to the database
part_aid_list = ibs.add_annots(
    part_parent_gid_list,
    bbox_list=part_bbox_list,
    theta_list=part_theta_list,
    species_list=part_new_species_list,
    viewpoint_list=part_viewpoint_list,
    notes_list=part_note_list,
)
```

These part annotation clones can be safely deleted after a new model is trained because we store the original copy as distinct parts in the database.

```python
# Get all annotation AIDs in the database
all_aid_list = ibs.get_valid_aids()

# Get the annotation notes
note_list = ibs.get_annot_notes(all_aid_list)

# Get the annotations that have the note "TEMPORARY"
flag_list = [note == 'TEMPORARY' for note in note_list]
delete_aid_list = ut.compress(all_aid_list, flag_list)

# Delete the temporary annotations in the database
ibs.delete_annots(delete_aid_list)
```

## Image Classification

The Whole-Image Classifier (WIC) is the first stage of the detection pipeline. Its primary goal is to make a "relevancy check" for all of the processing in the detection pipeline. Thus, for example, there would be no need to power up an advanced animal detection neural network and load its hefty weights into GPU memory for an image of a birthday party. A benefit of using a first-pass image classifier is that it can be trained with relatively little training data. We can therefore expect this component to be very accurate and fast. There are two use cases where the WIC is helpful within an automated animal detection pipeline:

1. checking for the existence of relevant species in an image for further processing, and
2. quickly processing large amounts of images to eliminate trivial negatives (e.g., filtering out false triggers made by camera traps).

### Train

In practice, the Wildbook and Codex platforms are not processing multiple or tens of thousands of images in a single request.  And, even if it ever does, these images are pre-curated prior to upload to the platform and are assumed to be cleaned up of irrelevant images.  As such, the image classifier is not used often on production systems, but this component is used for as-needed, image-level classification for custom applications.  The component is trained as either a multi-class or binary classifier (positive / negative), but is often trained as a simple yes/no decider.  As such, we can dramatically simplify and generalize the training apparatus by providing the training code with two imagesets: one for positive example images, and a second for negative example images.  Below is the code for training the binary classifier, for example as it is used for the Scout project.

#### GPU Configuration

As a quick note, this model is trained using PyTorch and will use as many GPUs during training as are exposed to the Python script below.  To target specific GPUs, you need to embed with an environment variable to specify which GPUs should be used.  For example, running the `embed` command with the `CUDA_VISIBLE_DEVICES` environment variable will target GPU IDs 0 and 1 for training.

```bash
CUDA_VISIBLE_DEVICES=0,1 embed
```

#### Prepare Examples

``` python
positive_gids = []  # Populate with positive image GIDs
negative_gids = []  # Populate with negative image GIDs
```

#### Assign to ImageSets

```python
positive_imageset = 'POSITIVES'
negative_imageset = 'NEGATIVES'
positive_imageset_id, negative_imageset_id = (
    ibs.get_imageset_imgsetids_from_text([
        positive_imageset,
        negative_imageset
    ])
)

# Add the images into the imgesets, by ID
ibs.set_image_imgsetids(
    positive_gids,
    [positive_imageset_id] * len(positive_gids)
)
ibs.set_image_imgsetids(
    negative_gids,
    [negative_imageset_id] * len(negative_gids)
)
```

#### Get Output Paths

```python
from os.path import join
import utool as ut

# Get hash of all data
all_gids = sorted(set(positive_gids + negative_gids))
hashstr = ut.hash_data(all_gids)
hashstr = hashstr[:16]

output_name = 'classifier.%s' % (hashstr, )
output_path = join(ibs.get_cachedir(), 'training', output_name)

# Ensure the output path on disk
ut.ensuredir(output_path)
```

#### Extract Training Data

This function will extract the data out of the WBIA database into a folder of named folders of images on disk.  This extraction can be downloaded and examined for consistency prior to training.  This function will respect the existing partitions for `TRAIN_SET` and `TEST_SET`, but will also create a random validation set automatically from the training data.

```python
from wbia.other.detectexport import (
    get_cnn_classifier_cameratrap_binary_training_images_pytorch,
)

# Export the images to disk and return the final exported path
extracted_path = get_cnn_classifier_cameratrap_binary_training_images_pytorch(
    ibs,
    positive_imageset_id,
    negative_imageset_id,
)
```

#### Train Models

Train independent models using the same extracted dataset on disk.  You may also provide different datasets to each ensemble if you prefer, as long as none of the datasets pull examples from the test set.  The validation set in the extracted dataset will be used to automatically select the model that has the lowest error, with early stopping.

```python
from wbia.algo.detect import densenet

ENSEMBLES = 3

# Train multiple models (default = 3), but can be as small as 1
weights_paths = []
for ensemble in range(ENSEMBLES):
    weights_path = densenet.train(
        extracted_path,
        output_path,
        sample_multiplier=1.0,
    )
    weights_paths.append(weights_path)
```

#### Aggregate Models Into Ensemble

```python
from os.path import join, exists
import utool as ut

ensemble_path = join(output_path, 'ensemble')
archive_path = join(output_path, '%s.ensemble.zip' % (output_name, ))

# Ensure final ensemble path
ut.ensuredir(ensemble_path)

# Collect all of the model weights into a single folder
ensemble_weights_path_list = [ensemble_path]
for index, weights_path in enumerate(sorted(weights_paths)):
    assert exists(weights_path)
    ensemble_weight_name = '%s.%d.weights' % (output_name, index,)
    ensemble_weights_path = join(ensemble_path, ensemgle_weight_name)
    ut.copy(weights_path, ensemble_weights_path)
    ensemble_weights_path_list.append(ensemble_weights_path)

# Archive the folder by zipping up all of the files into a single bundle
ut.archive_files(
    archive_path,
    ensemble_weights_path_list,
    overwrite=True,
    common_prefix=True
)
```

The file that is created at `archive_path` is the final ensemble file that should be deployed to a model zoo or CDN for downloading.  The model weights and classes that were used to train the models within the ensemble are saved within each weights file.

### Evaluate & Deploy

The above `archive_path` should then be made available as a deployed model, which can be downloaded by the evaluation script to check how well the model works.  Open `wbia/algo/detect/densenet.py` and modify the `ARCHIVE_URL_DICT` dict at the top of the file to add a new model:

```python
ARCHIVE_URL_DICT = {
    ...
    '<model tag>': 'https://cdn.domain.com/classifier.<hash>.ensemble.zip',
}
```

Once the `<model tag>` has been added to `densenet.ARCHIVE_URL_DICT`, we can rely on the model for all evaluation and inference.  It is possible to do this evaluation without uploading the file to a CDN or web file host, but it is more complex.  It is recommended to simply add them and delete them if the files fail to pass validation.  The code will use the same positive and negative imagesets we defined above and will automatically filter the images by the `TEST_SET` imageset during evaluation.

#### Establish Configs

```python
config_list = [
    {
        'label': 'Model 1',
        'classifier_algo': 'densenet',
        'classifier_weight_filepath': '<model tag>',
    },
]
```

#### Render Results

```python
ibs.classifier_cameratrap_precision_recall_algo_display(
    positive_imageset_id,
    negative_imageset_id,
    config_list=config_list,
)
```

The above code will render an image to disk, by default, to the user's desktop.  An example can be seen below for three models on the Scout project.  The evaluation plots will show both a Precision-Recall (PR) curve and a Receiver Operating Characteristic (ROC) curve and corresponding confusion matrices below each.  The Average Precision (AP) and Area Under the Curve (AUC) are provided for each of the configurations.  The best Operating Point (OP) is selected by the closest points on each respective configuration to the best overall performance.  For the PR curve, the best performance point is in the top-right corner.  For the ROC curve, the best performance point is the top-left corner.  The confusion matrices for each of the plots are plotted for the best-performing curve within each plot, respectively.  The plotted points on each curve are the optimized performance and the titles of the confusion matrix show the best configuration and the recommended OP.  The final accuracy for the selected configuration and OP are shown at the bottom.

![Classifier Evaluation Plots](../../../static/img/wbia_classifier_eval.jpg)

## Annotation Localization

The second component of the detection pipeline is tasked with generating bounding boxes and species labels for the relevant animals in an image. Localization is vital from an identification perspective because it allows for the separation of distinct animals, gives a consistent and comparable scale of the different sightings, and supplies a method (cropping) to remove large amounts of distracting background information. Furthermore, the preciseness of the bounding boxes (i.e., how well they fit snugly around an animal) can play a critical role in the overall accuracy of the identification pipeline. After all, annotations are the primary lens through which an ID algorithm sees the world, and the localizer should be very careful not to produce confusing or poorly-formed bounding boxes. This filtering role also means that the quality of the localization component plays a crucial role in the overall quality of the pipeline's results.

![Example Bounding Box Detections](../../../static/img/wbia_detection.jpg)

### Train

#### Establish Species & Mapping

``` python
species_list = [
    'whale_beluga',
    'whale_beluga_calf',
]

species_mapping = {}
```

#### Get Relevant Images

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by training set
train_gid_list = general_get_imageset_gids(ibs, 'TRAIN_SET')

# Get final training gids that have been reviewed
gid_list = sorted(list(set(train_gid_list) & set(reviewed_gid_list)))
```

#### Train Model

```python
deploy_path = ibs.localizer_lightnet_train(
    species_list,
    species_mapping=species_mapping,
    gid_list=gid_list,
    cuda_device='0',  # Pick the GPU device to train the model on
)
```

### Evaluate & Deploy

The above code will return a `deploy_path` and will also print out the final models to the screen.  The final model is actually comprised of a `.py` file and a `.weights` file.  Both of these files must be uploaded to a CDN, but can be renamed to a more convenient name, like `detect.lightnet.<HASH>.py` and `detect.lightnet.<HASH>.weights`.  Open `wbia/algo/detect/lightnet.py` and modify the `CONFIG_URL_DICT` dict at the top of the file to add a new model:

```python
CONFIG_URL_DICT = {
    ...
    '<model tag>': 'https://cdn.domain.com/detect.lightnet.<HASH>.py',
}
```

Once the `<model tag>` has been added to `lightnet.CONFIG_URL_DICT`, we can rely on the model for all evaluation and inference.  The `.py` file must have the same name as the accompanying `.weights` file; if the files are uploaded with the correct name then the weights file URL is inferred from the Python configuration file.  It is possible to do this evaluation without uploading the file to a CDN or web file host, but it is more complex.  It is recommended to simply add them and delete them if the files fail to pass validation.  The code will automatically filter the images by the `TEST_SET` imageset during evaluation.

#### Establish Configs

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

model_tag = '<model tag>'
species_set = set(species_list)  # The set of species for each config can be specified manually

config_dict = {
    'model1': (
        [
            {
                'label': 'Model 1 NMS 10%',
                'algo': 'lightnet',
                'config_filepath': model_tag,
                'weight_filepath': model_tag,
                'nms_thresh': 0.10,
                'species_set': species_set,
            },
            {
                'label': 'Model 1 NMS 30%',
                'algo': 'lightnet',
                'config_filepath': model_tag,
                'weight_filepath': model_tag,
                'nms_thresh': 0.30,
                'species_set': species_set,
            },
            {
                'label': 'Model 1 NMS 50%',
                'algo': 'lightnet',
                'config_filepath': model_tag,
                'weight_filepath': model_tag,
                'nms_thresh': 0.50,
                'species_set': species_set,
            },
            {
                'label': 'Model 1 NMS 70%',
                'algo': 'lightnet',
                'config_filepath': model_tag,
                'weight_filepath': model_tag,
                'nms_thresh': 0.70,
                'species_set': species_set,
            },
            {
                'label': 'Model 1 NMS 90%',
                'algo': 'lightnet',
                'config_filepath': model_tag,
                'weight_filepath': model_tag,
                'nms_thresh': 0.90,
                'species_set': species_set,
            },
        ],
        {
            'plot_iou_recall': True,  # Flag to plot the IoU-Recall curve (can be slow)
            'min_overlap': 0.5,  # The Intersection over Union (IoU) threshold
        },
    ),
}
```

#### Get Relevant Images

```python
# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by test set
test_gid_list = general_get_imageset_gids(ibs, 'TEST_SET')

# Get final test gids that have been reviewed
gid_list = sorted(list(set(test_gid_list) & set(reviewed_gid_list)))
```

#### Render Results

```python
# Render evaluation plots
ibs.localizer_precision_recall(
    test_gid_list=gid_list,
    config_dict=config_dict
)
```

The above code will render an image to disk, by default, to the user's desktop.  An example can be seen below for a single Beluga detection model for multiple Non-Maximum Suppression (NMS) thresholds, as configured.  The evaluation plots will show both a Precision-Recall (PR) curve, a Recall-IoU curve, and two confusion matrices.  The Average Precision (AP) and Area Under the Curve (AUC) are provided for each of the configurations.  The best Operating Point (OP) is selected by the closest points on each respective configuration to the best overall performance.  For the PR curve, the best performance point is in the top-right corner.  For the Recall-IoU curve, there is not an ideal OP and points are not plotted.  The confusion matrices are plotted for the best-performing curve (highest AP) and the curve with the highest Precision given a target recall (e.g., 80%).  The plotted points on each curve are the optimized performance and the titles of the confusion matrix show the best configuration and the recommended OP.  The final accuracy for the selected configuration and OP are shown at the bottom.

![Localizer Evaluation Plots](../../../static/img/wbia_detection_eval.jpg)

It should be noted that a ROC plot cannot be provided for detections.  This is because the concept of a True Negative (TN) is undefined for object detection (i.e., what does it mean to correctly not predict a box where a box shouldn't have been?).  Furthermore, the determination of if a predicted box is a True Positive (TP), a greedy matching algorithm is used to select the highest confidence box for a given Intersection over Union (IoU) threshold and if the species of the ground-truth (GT) and prediction matches.  Any remaining boxes that are not matched are either False Positives (additional boxes) or False Negatives (missed boxes).  The second plot (Recall-IoU) shows the recall curves for each configuration (by selecting the OP that optimizes general performance) and demonstrates how lowering the IoU threshold could potentially increase recall.  The benefit of such an analysis is that the IoU threshold is somewhat arbitrary and, depending on the use case, could be specified at 60% (requiring very accurate boxes) to emphasize the preciseness of the boxes or at 25% (requiring loose boxes) to allow the detector to be treated more like a salient detector (useful for aerial applications).

To visualize the final detections against the ground-truth boxes, use the following code:

```python
config = {
    'grid': False,
    'algo': 'lightnet',
    'config_filepath': model_tag,
    'weight_filepath': model_tag,
    'nms': True,
    'nms_thresh': 0.50,  # Based on the evaulation plots
    'sensitivity': 0.50,  # Based on the evaulation plots
}
ibs.visualize_ground_truth(config, gid_list=gid_list)
ibs.visualize_predictions(config, gid_list=gid_list)
```

## Annotation Classification

The third component of the detection pipeline is designed to re-classify the annotations produced by the previous localization stage. The primary purpose of the annotation classification network (also known as the "annotation labeler") is flexibility. For example, the species-only classification output of the localizer may not be the final (or only) intended metadata for an annotation. Furthermore, it may be impractical to retrain the entire localizer when a new classification need comes up. A practical use case of the labeler is that it allows the pipeline to predict a species and a viewpoint for annotations. This function is handy for identification because knowing the viewpoint of an animal allows for incompatible annotations to be filtered out, even more so than compared to only filtering on species. It also allows for the localization network to be trained at a different level of abstraction when considering the ground-truth labels. For example, we may train the localizer to focus on a general "zebra" class (e.g., to optimize localization performance) but use the labeler to re-classify annotations as "Grevy's zebra" or "Plains zebra", and add viewpoint classification support.

### Train

#### Establish Species & Mapping

```python
species_list = [
    'whale_beluga',
    'whale_beluga_calf',
]

species_mapping = {}

viewpoint_mapping = {
    'whale_beluga': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    },
    'whale_beluga_calf': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    }
}

# Allow viewpoints to assume different labels during extraction
# Flipping is always horizontal and is specified with a p=0.5
flip_mapping = {
    'left': 'right',
    'right': 'left',
}
```

#### Get Relevant Images

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by training set
train_gid_list = general_get_imageset_gids(ibs, 'TRAIN_SET')
```

#### Train Model

```python
archive_path = ibs.labeler_train(
    species_list,
    species_mapping=species_mapping,
    viewpoint_mapping=viewpoint_mapping,
    flip_mapping=flip_mapping,
    min_examples=0,  # Used to require a class to have X classes to be included
    strict=False,  # Used to require a species to have all 8 lateral viewpoints
    use_axis_aligned_chips=True,  # Use axis-aligned boxes for any oriented ground-truth
    train_gid_set=train_gid_list
)
```

### Evaluate & Deploy

The above `archive_path` should then be made available as a deployed model, which can be downloaded by the evaluation script to check how well the model works.  Open `wbia/algo/detect/densenet.py` and modify the `ARCHIVE_URL_DICT` dict at the top of the file to add a new model:

```python
ARCHIVE_URL_DICT = {
    ...
    '<model tag>': 'https://cdn.domain.com/labeler.<hash>.zip',
}
```

Once the `<model tag>` has been added to `densenet.ARCHIVE_URL_DICT`, we can rely on the model for all evaluation and inference.  It is possible to do this evaluation without uploading the file to a CDN or web file host, but it is more complex.  It is recommended to simply add them and delete them if the files fail to pass validation.  The code will automatically filter the images by the `TEST_SET` imageset during evaluation.  Below is an example evaluation for giraffes.

#### Establish Species & Mapping

```python
species_list = [
    'giraffe_masai',
    'giraffe_reticulated',
]

viewpoint_mapping = {
    'giraffe_masai': {
        'left'       : 'left',
        'frontleft'  : 'frontleft',
        'front'      : 'front',
        'frontright' : 'frontright',
        'right'      : 'right',
        'backright'  : 'backright',
        'back'       : 'back',
        'backleft'   : 'backleft',
    },
    'giraffe_reticulated': {
        'left'       : 'left',
        'frontleft'  : 'frontleft',
        'front'      : 'front',
        'frontright' : 'frontright',
        'right'      : 'right',
        'backright'  : 'backright',
        'back'       : 'back',
        'backleft'   : 'backleft',
        'down'       : None,
        'downleft'   : 'left',
        'ignore'     : None,
        'unknown'    : None,
        'upback'     : 'back',
        'upfront'    : 'front',
    },
}

# Specify the order of the classes in the confusion matrix
category_mapping = {
    'giraffe_masai:left'             : 0,
    'giraffe_masai:frontleft'        : 1,
    'giraffe_masai:front'            : 2,
    'giraffe_masai:frontright'       : 3,
    'giraffe_masai:right'            : 4,
    'giraffe_masai:backright'        : 5,
    'giraffe_masai:back'             : 6,
    'giraffe_masai:backleft'         : 7,
    'giraffe_reticulated:left'       : 8,
    'giraffe_reticulated:frontleft'  : 9,
    'giraffe_reticulated:front'      : 10,
    'giraffe_reticulated:frontright' : 11,
    'giraffe_reticulated:right'      : 12,
    'giraffe_reticulated:backright'  : 13,
    'giraffe_reticulated:back'       : 14,
    'giraffe_reticulated:backleft'   : 15,
}

# Specify the classes that are allow to be approximate classes
# This fuzzy mapping uses the above category mapping values
# Note, you must include the key's value in this list as well
fuzzy_dict = {
    0  : [7, 0, 1],
    1  : [0, 1, 2],
    2  : [1, 2, 3],
    3  : [2, 3, 4],
    4  : [3, 4, 5],
    5  : [4, 5, 6],
    6  : [5, 6, 7],
    7  : [6, 7, 0],
    8  : [15, 8, 9],
    9  : [8, 9, 10],
    10 : [9, 10, 11],
    11 : [10, 11, 12],
    12 : [11, 12, 13],
    13 : [12, 13, 14],
    14 : [13, 14, 15],
    15 : [14, 15, 8],
}
```

#### Establish Configs

```python
config_list = [
    {
        'label': 'Giraffe',
        'category_list': ['giraffe_masai', 'giraffe_reticulated'],
    },
    {
        'label': 'Masai Giraffe',
        'category_list': ['giraffe_masai'],
    },
    {
        'label': 'Reticulated Giraffe',
        'category_list': ['giraffe_reticulated'],
    },
]
```

#### Get Relevant Images

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by test set
test_gid_list = general_get_imageset_gids(ibs, 'TEST_SET')

# Get final test gids that have been reviewed
gid_list = sorted(list(set(test_gid_list) & set(reviewed_gid_list)))
```

#### Render Results

```python
ibs.labeler_precision_recall_algo_display(
    labeler_weight_filepath='<model tag>',
    category_list=species_list,
    viewpoint_mapping=viewpoint_mapping,
    category_mapping=category_mapping,
    fuzzy_dict=fuzzy_dict,
    config_list=config_list,
    test_gid_set=gid_list,
    use_axis_aligned_chips=True,  # Mirror the value used with training
)
```

The above code will render an image to disk, by default, to the user's desktop.  An example can be seen below for a giraffe species and viewpoint classification model.  The evaluation plots will show both a Precision-Recall (PR) curve, a Receiver Operating Characteristic (ROC) curve, and the confusion matrix.  The Average Precision (AP) and Area Under the Curve (AUC) are provided for each of the configurations.  The best Operating Point (OP) is selected by the closest points on each respective configuration to the best overall performance.  For the PR curve, the best performance point is in the top-right corner.  For the ROC curve, the best performance point is the top-left corner.  The confusion matrix is plotted for all species.  The plotted points on each curve are the optimized performance.

![Classifier Evaluation Plots](../../../static/img/wbia_labeler_eval.jpg)

The final classification accuracy are shown below the confusion matrix, but there are two accuracies reported.  The first is the correct classification accuracy for if the prediction class matches the ground-truth class.  The second is a "fuzzy" classification that allows slight misclassifications to be treated as correct classifications.  For example, if the viewpoint is predicted as "left" when the correct species is "front-left", we can gauge how well the classifier is at predicting exact classes and classes that are almost correct.

## Coarse Background Segmentation

The fourth detection pipeline component attempts to produce a coarse segmentation of an animal. The modifier "coarse" is intentionally added to the method description because it is not meant to be (or compete with) a pixel-level semantic segmentation algorithm. Instead, a classification technique is presented that approximates a pixel-level segmentation by creating a binary classification map. The task is to take an annotation (with a species provided by the labeler) and roughly classify which pixels belong to that species versus the background. The goal is to generate a rough background mask that can eliminate or otherwise down-weight distracting non-animal pixel information. For example, the output of this component can be used to calculate weights for SIFT keypoints and the features used by an identification pipeline. Key design features of this component are:

1. it only requires species-labeled bounding boxes for ground-truth and does not require fully-segmented images,
2. it is trained on small positive or negative patches as a binary classifier, and
3. it is applied fully convolutionally across an entire input image to produce a rough semantic segmentation map.

![Example Background Segmentations](../../../static/img/wbia_background.jpg)

### Train

#### Get Relevant Images

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by training set
train_gid_list = general_get_imageset_gids(ibs, 'TRAIN_SET')
```

#### Train Model

```python
model_path = ibs.background_train('whale_beluga', train_gid_set=gids_, global_limit=100000)
```

The background classifier is one of the oldest algorithms in WBIA, whereas the rest have been incrementally replaced over time.  This requires that between training multiple models for background subtraction, the extracted data and models from the previous run must be deleted manually when inside the Docker container:

```bash
rm -rf /data/db/_ibsdb/_ibeis_cache/extracted/background*
rm -rf /data/db/_ibsdb/_ibeis_cache/training/background*
rm -rf /data/db/models/arch_background*
````

### Evaluate & Deploy

The above `model_path` should then be made available as a deployed model, which can be downloaded by the evaluation script to check how well the model works.  Open `wbia-plugin-cnn/wbia_cnn/_plugin_grabmodels.py` (a plug-in for WBIA) and modify the `MODEL_URLS` dict at the top of the file to add a new model:

```python
MODEL_DOMAIN = 'https://wildbookiarepository.azureedge.net/models/'
MODEL_URLS = {
    ...
    '<model tag>': 'background.<hash>.pkl',
}
```

Then, add the following block of code to `wbia-plugin-cnn/wbia_cnn/_plugin.py::generate_species_background()` as an additional `elif:` block:

```python
elif species in [
    'whale_beluga',
]:
    LEGACY = False
    species = 'whale_beluga'
    confidence_thresh = 0.2
    model = models.BackgroundModel(batch_size=batch_size, data_shape=data_shape)
    weights_path = grabmodels.ensure_model(
        '<model tag>', redownload=False
    )
    canvas_key = 1
```

Lastly, we need to enable automatic background subtraction for the given species whenever an appropriate ID algorithm is called by WBIA.  We need to specify it by modifying `wbia/constants.py` and add a new line to `SPECIES_WITH_DETECTORS`:

```python

SPECIES_WITH_DETECTORS = (
    ...
    'whale_beluga',
)
```

The background subtraction code is evaluated qualitatively, not quantitatively by WBIA.  This is because WBIA does not normally store fully segmented ground truth for a given annotation (only the bounding box).  Furthermore, the WBIA interface contains no interface for drawing such segmentation ground-truth.  These limitations mean that it is not possible to perform a complete validation step with accuracy numbers.  That being said, we can evaluate the impact on any ID results with the HotSpotter algorithm when keypoints are weighted by the background mask versus when they are not.  In practice, the coarse background segmentations tend to give a 5-10% improvement in top-k accuracy.

#### Get Relevant Images

To visualize the background masks on held-out test annotations, use the following code:

```python
from wbia.other.detectfuncs import general_get_imageset_gids
import utool as ut

# Get all gids
all_gid_list = ibs.get_valid_gids()

# Filter by reviewed (optional)
reviewed_list = ibs.get_image_reviewed(all_gid_list)
reviewed_gid_list = ut.compress(all_gid_list, reviewed_list)

# Filter by test set
test_gid_list = general_get_imageset_gids(ibs, 'TEST_SET')

# Get final test gids that have been reviewed
gid_list = sorted(list(set(test_gid_list) & set(reviewed_gid_list)))
```

#### Render Results

```python
species_list = [
    'whale_beluga',
]
ibs.background_accuracy_display(category_list=species_list, test_gid_set=gid_list)
```

## Annotation of Interest (AoI) Classification

The fifth and final detection component focuses on determining which animal annotations in an image are good candidates for identification. The goal of AoI classification is to try and answer the question, "why did the photographer take this picture?" and is tasked with distinguishing the animals that were the intended subject(s) (i.e., the "Annotations of Interest") from incidental background sightings of animals. It is important to note that this task tries to understand the composition of an image a posteriori to help guide ID and is not concerned with the aesthetic form of a particular image or calculated focus points. Instead, the Annotation of Interest (AoI) classifier identifies the most prominent animals in the image because they are likely to be the most identifiable. While state-of-the-art object detection algorithms are often compared and evaluated on their ability to localize all objects of interest captured in an image &emdash; regardless of the pose, lighting, aspect ratio, focus, scale, level of obscurity, or degree of truncation &emdash; a different objective is needed when animal ID is the intended use case: one that can be optimized for only detecting identifiable animals. To do this, though, we first need to know which annotations are even identifiable because the value of an animal detection should be fundamentally tied to the amount of identifying visual information it provides.

### Train

This ML component is deprecated and is no longer trained at Wild Me.

### Evaluate & Deploy

The benefit of continuing to consider AoI is that it allows the detector to optimize for detecting foreground annotations over background annotations.  For example, in a complex scene with many animals, we want the detector to prioritize the detection of clear, complete, well-illuminated, well-focused foreground animals.  The benefit of optimizing the detection and its recommended parameters for this use case is that we simply don't care about missing background detections if they do not provide usable ID information in the first place.  Before this component can be used, some of the annotations in the database must be marked as AoIs.

For example, below are the performance plots for wild dogs without AoI filtering (all bounding boxes, including AoIs):

![Detection Performance on All Ground-Truth Boxes](../../../static/img/wbia_aoi_without.jpg)

And below are the performance plots for wild dogs with AoI filtering:

![Detection Performance on AoI Ground-Truth Boxes](../../../static/img/wbia_aoi_with.jpg)

We can see that there is a noticeable bump in detection accuracy from 63.4% to 74.9% and the AP from 74% to 86%.  The benefit of optimizing for AoIs is that the pipeline ignores background annotations, and the recommended configurations change fairly dramatically.  Without AoI filtering, the best model uses an NMS threshold of 50% and an OP of 33%.  The best configuration with AoI filtering is, in contrast, an NMS threshold of 40% and an OP of 50%.

## Annotation Orientation

One of the most significant optional components has the goal of rotating axis-aligned annotations produced by the localizer. The reason orientation is essential is that ID algorithms can be susceptible to rotation and, for example, can fail to match an annotation correctly if it is upside down compared to a database of consistently rotated annotations. The orientation of annotations should not be confused with its viewpoint. The viewpoint is the side of the animal that is seen (e.g., left-side), but orientation is the rotation on the annotation such that it has a normalized view (e.g., putting the feet of a left-side zebra at the bottom of the annotation). Furthermore, if we rotate an axis-aligned bounding box that is snugly fit to the animal, the new box may be slightly too large or too small in a given direction. Therefore, we want to rotate the original bounding box and modify it to fit appropriately. An example rotated ground-truth annotation can be seen below for North Atlantic Right Whale heads used for ID.

![Example Annotation Orientations](../../../static/img/wbia_orientation.jpg)

### Train

Refer to the plug-in repository for information on its training instructions: [WBIA Orientation Plug-in](https://github.com/WildMeOrg/wbia-plugin-orientation/tree/main/wbia_orientation)

#### Establish Species & Mapping

```python
species_list = [
    'whale_beluga',
    'whale_beluga_calf',
]

species_mapping = {}

viewpoint_mapping = {
    'whale_beluga': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    },
    'whale_beluga_calf': {
        'up'         : 'up',
        'left'       : 'left',
        'frontleft'  : 'left',
        'backleft'   : 'left',
        'upleft'     : 'left',
        'right'      : 'right',
        'frontright' : 'right',
        'backright'  : 'right',
        'front'      : None,
        'back'       : None,
        'down'       : None,
        'unknown'    : None,
        None         : None,
    }
}
```

#### Get Relevant Images

```python
ibs.export_to_coco(
    species_list,
    species_mapping=species_mapping,
    viewpoint_mapping=viewpoint_mapping,
    include_parts=False,
    require_image_reviewed=True,
    include_reviews=False
)
```

#### Establish Config File

From within the Docker container, the training script is run independently of the WBIA codebase and controller.

```bash
# Actiate virtualenv
source /virtualenv/env3/bin/activate

# change into the plugin directory
cd /wbia/wbia-plugin-orientation/

# Make a new location for the extracted dataset
mkdir -p wbia_orientation/data/
mv /data/db/_ibsdb/_ibeis_cache/coco/ wbia_orientation/data/orientation.<species>.coco/

# Create a training configuration file
echo """DATASET:
  NAME: '<species>'
TEST:
  MODEL_FILE: 'wbia_orientation/output/<species>_orientation_v0/best.pth'
  BS: 32
VERSION: v0""" > wbia_orientation/config/orientation.<species>.yaml
```

#### Train Model

```bash
# Run the training script
python wbia_orientation/train.py --cfg wbia_orientation/config/orientation.<species>.yaml
```

### Evaluate & Deploy

The above `wbia_orientation/output/<species>_orientation_v0/best.pth` should then be available for immediate validation by running the following:

```bash
python wbia_orientation/test.py --cfg wbia_orientation/config/orientation.<species>.yaml
```

Once the final model has been created, it should be made available as a deployed model in the CDN.  Open `wbia-plugin-orientation/wbia_orientation/_plugin.py` (a plug-in for WBIA) and modify the `MODEL_URLS`, `CONFIGS`, and `DATA_ARCHIVES` dicts at the top of the file to add a new model:

```python
MODEL_URLS = {
    ...
    '<model tag>': 'https://cdn.domain.com/orientation.<species>.pth',
}

CONFIGS = {
    ...
    '<model tag>': 'https://cdn.domain.com/orientation.<species>.yaml',
}

DATA_ARCHIVES = {
    ...
    '<model tag>': None,  # No data archive by default
}
```

The orientation code will render images to disk for example test images and will print out performance numbers on how accurate the predicted bounding box orientations are.

## Annotation Body/Part Assignment

A second use case that is very useful is localizing specific parts for an animal.  A part of an animal is sometimes the better candidate for ID compared to the full-body annotation.  For example, a sea turtle does not have reliable ID information on the shell.  The patterns change over time, and more stable facial patterns can be used for visual ID.  The localizer component in the detection pipeline is optimized for finding the complete body annotation for a given animal. However, often a part like a head or an ear needs to be localized as well.  For example, extracting part bounding boxes for dorsal fins or elephant ears can be beneficial since contour-based algorithms need a consistent starting point and a way to find specific parts of an animal.

### Train

#### Get Relevant Images

```python
from wbia.algo.detect.train_assigner import (
    balance_true_false_training_pairs,
    save_parts_as_annots,
    gid_train_test_split,
    split_list,
    CURRENT_DEFAULT_FEATURE,
)

# Load all parts and convert them to annotations
pids = ibs.get_valid_part_rowids()
save_parts_as_annots(ibs, pids)

# Gather training data
all_aids = ibs.get_valid_aids()
all_species = ibs.get_annot_species(all_aids)
is_lion = ['lion' in spec for spec in all_species]
all_aids = ut.compress(all_aids, is_lion)

# Get ground truth names and assignments
ia_classes = ibs.get_annot_species(all_aids)
part_aids = [aid for aid, ia_class in zip(all_aids, ia_classes) if '+' in ia_class]
part_gids = list(set(ibs.get_annot_gids(part_aids)))
all_pairs = all_part_pairs(ibs, part_gids)
names = [ibs.get_annot_names(all_pairs[0]), ibs.get_annot_names(all_pairs[1])]
ground_truth = [n1 == n2 for (n1, n2) in zip(names[0], names[1])]

# Balance true/false examples
keep_flags = balance_true_false_training_pairs(ground_truth)
# janky bc all_pairs is a tuple so we can't do item-assignment
all_pairs0 = ut.compress(all_pairs[0], keep_flags)
all_pairs1 = ut.compress(all_pairs[1], keep_flags)
all_pairs = (all_pairs0, all_pairs1)
ground_truth = ut.compress(ground_truth, keep_flags)

# Compute features
all_feats = ibs.depc_annot.get(CURRENT_DEFAULT_FEATURE, all_pairs)
pairs_in_train = gid_train_test_split(
    ibs, all_pairs[0], test_size=0.3
)  # we could pass just the pair aids or just the body aids bc gids are the same

# Split training/test set
train_feats, test_feats = split_list(all_feats, pairs_in_train)
train_truth, test_truth = split_list(ground_truth, pairs_in_train)

# Split training/test set pairs
all_pairs_tuple = [(part, body) for part, body in zip(all_pairs[0], all_pairs[1])]
train_pairs, test_pairs = split_list(all_pairs_tuple, pairs_in_train)

# Aggregate assigner data
assigner_data = {
    'data': train_feats,
    'target': train_truth,
    'test': test_feats,
    'test_truth': test_truth,
    'train_pairs': train_pairs,
    'test_pairs': test_pairs,
}
```

#### Grid Search for Best Algorithm

```python
from wbia.algo.detect.train_assigner import (
    CLASSIFIER_OPTIONS,
    _tune_grid_search,
)
from collections import OrderedDict

accuracies = OrderedDict()
best_acc = 0
best_clf_name = ''
best_clf_params = {}
for classifier in CLASSIFIER_OPTIONS:
    print('Tuning %s' % classifier['name'])
    accuracy, best_params = _tune_grid_search(
        ibs, classifier['clf'], classifier['param_options'], assigner_data
    )
    print()
    accuracies[classifier['name']] = {
        'accuracy': accuracy,
        'best_params': best_params,
    }
    if accuracy > best_acc:
        best_acc = accuracy
        best_clf_name = classifier['name']
        best_clf_params = best_params

print(
    'best performance: %s using %s with params %s'
    % (best_acc, best_clf_name, best_clf_params)
)
```

#### Train Model

Using the best configuration found during the grid search, train the final model

```python
import joblib

from sklearn.tree import DecisionTreeClassifier
clf = DecisionTreeClassifier(max_depth=6, max_leaf_nodes=10)
model = clf.fit(assigner_data['data'], assigner_data['target'])

model_path = joblib.dump(model, '/data/db/_ibsdb/_ibeis_cache/assigner.<species>.joblib')
```

### Evaluate & Deploy

The above `model_path` should then be made available as a deployed model, which can be downloaded by the evaluation script to check how well the model works.  Open `wbia/algo/detect/assigner.py` and modify the `SPECIES_CONFIG_MAP` dict at the top of the file to add a new model:

```python
SPECIES_CONFIG_MAP = {
    ...
    '<model_tag>': {
        'model_file': '/tmp/assigner.<species>.joblib',
        'model_url': 'https://cdn.domain.com/assigner.<species>.joblib',
        'annot_feature_col': 'assigner_viewpoint_unit_features',
    },
}
```

Once the `<model tag>` has been added to `assigner.SPECIES_CONFIG_MAP`, we can rely on the model for all evaluation and inference.  It is possible to do this evaluation without uploading the file to a CDN or web file host, but it is more complex.  It is recommended to simply add them and delete them if the files fail to pass validation.

```python
aids_list = []  # Output from detection, list of list of aids

for aids in aids_list:
    assigned, unassigned = ibs.assign_parts_one_image(aids)
```

## Conclusion

All of the above detection components are trained separately and evaluated independently.  In general, the process is to exract the training data as a separate dataset on disk, train a new model on that dataset, evaluate the model by downloading it from an external CDN, and then deploying the model by editing the WBIA (or plug-in) code to enable the new configuration.  Once the code has been modified, a new WBIA Docker image can be built and a given WBIA instance can be updated to the latest image version to get access to the latest models.

### Download Example WBIA Database

Download an example WBIA database here: https://wildbookiarepository.azureedge.net/databases/testdb_orientation.zip (2.0GB)

### Full Code Example

Below is an example training script for Grevy's zebra for the standard detection pipeline: image classification, annotation localization, annotation classification, and background subtraction.  This dataset does not contain parts (no body/part assignments) and none of the annotations have orientations (i.e., the boxes are are axis-aligned).

#### Install Dependencies & Configure Environment

```bash
sudo apt install wget unzip tmux
```

#### Setup Environment

```bash
# It is highly recommended to use screen or tmux when interacting with WBIA for training
tmux new-session -s wbia
```

#### Download Database

```bash
cd ~/

mkdir -p $(pwd)/wbia
cd $(pwd)/wbia

wget https://wildbookiarepository.azureedge.net/databases/demo.tar.gz
tar -zxvf demo.tar.gz
```

#### Configure & Start WBIA

```bash
echo """
HOST_UID=$(id -u)
HOST_USER=$(whoami)
""" > $(pwd)/wbia.env

docker run \
    -d \
    --gpus '"device=0,1"' \
    --shm-size=8g \
    --name wbia.training \
    -v $(pwd)/demo:/data/db \
    -v $(pwd)/cache:/cache \
    --env-file $(pwd)/wbia.env \
    --restart unless-stopped \
    wildme/wbia:latest \
        --engine-slow-lane-workers 0 \
        --engine-fast-lane-workers 0

# Logging (wait for system to come up, then continue)
docker logs --follow wbia.training

docker exec -it wbia.training embed
```

#### Database Stats

```python
>>> import utool as ut
>>> gids = ibs.get_valid_gids()
>>> aids = ibs.get_valid_aids()

>>> print(len(gids))
5802

>>> print(len(aids))
14708

>>> print(ut.repr3(ut.dict_hist(ibs.get_annot_species(aids))))
{
    '____': 1,
    'antelope': 210,
    'bird': 730,
    'camel': 1,
    'car': 6,
    'domesticated_cow': 25,
    'donkey': 27,
    'elephant_savanna': 18,
    'gazelle': 43,
    'giraffe_reticulated': 1540,
    'goat': 95,
    'horse': 12,
    'ignore': 758,
    'impala': 133,
    'lion': 29,
    'ostrich': 11,
    'person': 57,
    'rhino_black': 6,
    'rhino_white': 25,
    'warthog': 7,
    'water_buffalo': 63,
    'zebra_grevys': 9662,
    'zebra_plains': 1249,
}

>>> species_list = [
>>>     'zebra_grevys',
>>> ]
>>>
>>> species_mapping = {}
>>>
>>> viewpoint_mapping = {
>>>     'zebra_grevys': {
>>>         'back'          : 'back',        # 290
>>>         'backleft'      : 'backleft',    # 167
>>>         'backright'     : 'backright',   # 928
>>>         'downbackright' : 'backright',   # 4
>>>         'downleft'      : 'left',        # 2
>>>         'downright'     : 'right',       # 17
>>>         'front'         : 'front',       # 114
>>>         'frontleft'     : 'frontleft',   # 118
>>>         'frontright'    : 'frontright',  # 275
>>>         'ignore'        : None,          # 617
>>>         'left'          : 'left',        # 667
>>>         'right'         : 'right',       # 6416
>>>         'unknown'       : None,          # 2
>>>         'upbackleft'    : 'backleft',    # 3
>>>         'upbackright'   : 'backright',   # 11
>>>         'upfrontleft'   : 'frontleft',   # 2
>>>         'upfrontright'  : 'frontright',  # 2
>>>         'upleft'        : 'left',        # 4
>>>         'upright'       : 'right',       # 23
>>>     },
>>> }
>>>
>>> # Get all images, their annotations, and their metadata
>>> gid_list = ibs.get_valid_gids()
>>> aid_list = ut.flatten(ibs.get_image_aids(gid_list))
>>> annot_gid_list = ibs.get_annot_gids(aid_list)
>>> annot_species_list = ibs.get_annot_species(aid_list)
>>> annot_viewpoint_list = ibs.get_annot_viewpoints(aid_list)
>>>
>>> # Construct a histogram of all species and their viewpoints
>>> hist_dict = {}
>>> zipped = zip(aid_list, annot_gid_list, annot_species_list, annot_viewpoint_list)
>>> for aid, annot_gid, species, viewpoint in zipped:
>>>     if species not in species_list:
>>>         continue
>>>     if species not in hist_dict:
>>>         hist_dict[species] = {}
>>>     viewpoint = viewpoint_mapping[species].get(viewpoint, viewpoint)
>>>     viewpoint_ = '%s:%s' % (species, viewpoint)
>>>     if viewpoint is None:
>>>         continue
>>>     if viewpoint not in hist_dict[species]:
>>>         hist_dict[species][viewpoint] = 0
>>>     hist_dict[species][viewpoint] += 1
>>>
>>> # Print out
>>> print(ut.repr3(hist_dict))
{
    'zebra_grevys': {
        'back': 290,
        'backleft': 170,
        'backright': 943,
        'front': 114,
        'frontleft': 120,
        'frontright': 277,
        'left': 673,
        'right': 6456,
    },
}
```

#### Make Train/Test Set

``` python
>>> ibs.imageset_train_test_split()
INFO:wbia:Processing train/test imagesets...
...
INFO:wbia:Complete... 4641 train + 1161 test = 5802 (0.7999 0.8000)

>>> from wbia.other.detectfuncs import general_get_imageset_gids
>>> train_gid_list = general_get_imageset_gids(ibs, 'TRAIN_SET')
>>> test_gid_list = general_get_imageset_gids(ibs, 'TEST_SET')
>>> len(train_gid_list)
4641

>>> len(test_gid_list)
1161
```

#### Train Multi-species Image Classifier

```python
>>> ibs.update_species_imagesets()
>>> imageset_texts = ['Species: Zebra Grevys', 'Species: Zebra Plains']
>>> positive_imageset_id, negative_imageset_id = ibs.get_imageset_imgsetids_from_text(imageset_texts)
>>> ibs.classifier_cameratrap_train(
>>>     positive_imageset_id=positive_imageset_id,
>>>     negative_imageset_id=negative_imageset_id,
>>> )
[util_path] Deleting path='/data/db/_ibsdb/_ibeis_cache/extracted/classifier-cameratrap'
..does not exist!
INFO:root:Processing GID: 1
INFO:root:Processing GID: 2
INFO:root:Processing GID: 3
INFO:root:Processing GID: 299
INFO:root:Processing GID: 300
INFO:root:Processing GID: 301
INFO:root:Processing GID: 302
INFO:root:Processing GID: 303
INFO:root:Processing GID: 304
INFO:root:Processing GID: 305
INFO:root:Processing GID: 306
INFO:root:Processing GID: 307
INFO:root:Processing GID: 308
INFO:root:Processing GID: 309
INFO:root:Processing GID: 310
INFO:root:Processing GID: 311
INFO:root:Processing GID: 312
INFO:root:Processing GID: 314
INFO:root:Processing GID: 317
INFO:root:Processing GID: 318
INFO:root:Processing GID: 319
...
```

#### Train Localizer

```python
>>> ibs.localizer_lightnet_train(
>>>     species_list,
>>>     species_mapping=species_mapping,
>>>     gid_list=train_gid_list,
>>>     cuda_device='0',
>>> )
[utool] Downloading url='https://wildbookiarepository.azureedge.net/data/lightnet-training-kit.zip' to filename='/cache/lightnet/lightnet-training-kit.zip'
...99%, 70 MB, 5869 KB/s, 12 seconds passed
[utool] Finished downloading filename='/cache/lightnet/lightnet-training-kit.zip'
Unarchive: '/cache/lightnet/lightnet-training-kit.zip'
[utool] Unarchive  in /cache/lightnet/lightnet-training-kit/bin
[utool] Unarchive train.template.py in /cache/lightnet/lightnet-training-kit/bin
[utool] Unarchive labels.template.py in /cache/lightnet/lightnet-training-kit/bin
[utool] Unarchive dataset.template.py in /cache/lightnet/lightnet-training-kit/bin
[utool] Unarchive test.template.py in /cache/lightnet/lightnet-training-kit/bin
[utool] Unarchive  in /cache/lightnet/lightnet-training-kit/cfg
[utool] Unarchive yolo.template.py in /cache/lightnet/lightnet-training-kit/cfg
[utool] Unarchive  in /cache/lightnet/lightnet-training-kit/data
[utool] Unarchive darknet19_448.conv.23.pt in /cache/lightnet/lightnet-training-kit/
[C] | /cache/lightnet/lightnet-training-kit
[C] ->/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045
isdir
INFO:wbia:Received species_mapping = {}
INFO:wbia:Using species_list = ['zebra_grevys']
INFO:wbia:Exporting 4641 images
INFO:wbia:              Adding 'zebra_grevys' with area 9434.0000 pixels^2
INFO:wbia:Copying:
'/data/db/_ibsdb/images/f5ee12ff-0a05-8a17-2bae-85852417ff52.jpg'
'/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045/data/VOCdevkit/VOC2022/JPEGImages/2022_000001.jpg'
(900, 675)


INFO:wbia:              Adding 'zebra_grevys' with area 6175.0000 pixels^2
INFO:wbia:Copying:
'/data/db/_ibsdb/images/7c974006-55dd-5047-3031-5c9a16215a36.jpg'
'/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045/data/VOCdevkit/VOC2022/JPEGImages/2022_000002.jpg'
(900, 675)


INFO:wbia:              Adding 'zebra_grevys' with area 6784.0000 pixels^2
INFO:wbia:Copying:
'/data/db/_ibsdb/images/751bb6b1-69f0-a6b2-4379-92156bdd214f.jpg'
'/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045/data/VOCdevkit/VOC2022/JPEGImages/2022_000003.jpg'
(900, 675)


INFO:wbia:Copying:
'/data/db/_ibsdb/images/da1a6670-496d-111f-f226-304976ce6f80.jpg'
'/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045/data/VOCdevkit/VOC2022/JPEGImages/2022_000004.jpg'
(900, 675)


INFO:wbia:Copying:
'/data/db/_ibsdb/images/89b9c82c-3fa2-8174-5b8c-edba49e2e07e.jpg'
'/data/db/_ibsdb/_ibeis_cache/training/lightnet/lightnet-training-zebra_grevys-f029a09b612a2045/data/VOCdevkit/VOC2022/JPEGImages/2022_000005.jpg'
(900, 675)


INFO:wbia:Skipping:
'/data/db/_ibsdb/images/e650fdcd-0209-cc65-9178-9446a94f4003.jpg'
...
```

#### Train Labeler

```python
>>> flip_mapping = {
>>>     'left': 'right',
>>>     'right': 'left',
>>>     'frontleft': 'frontright',
>>>     'frontright': 'frontleft',
>>>     'backleft': 'backright',
>>>     'backright': 'backleft',
>>> }
>>>
>>> ibs.labeler_train(
>>>     species_list,
>>>     species_mapping=species_mapping,
>>>     viewpoint_mapping=viewpoint_mapping,
>>>     flip_mapping=flip_mapping,
>>>     min_examples=0,
>>>     strict=False,
>>>     use_axis_aligned_chips=True,
>>>     train_gid_set=train_gid_list
>>> )
[util_path] Deleting path='/data/db/_ibsdb/_ibeis_cache/extracted-labeler-zebra_grevys/labeler-pytorch'
..does not exist!
INFO:wbia:category mapping = {}
INFO:wbia:viewpoint mapping = {
    'zebra_grevys': {
        'back': 'back',
        'backleft': 'backleft',
        'backright': 'backright',
        'downbackright': 'backright',
        'downleft': 'left',
        'downright': 'right',
        'front': 'front',
        'frontleft': 'frontleft',
        'frontright': 'frontright',
        'ignore': None,
        'left': 'left',
        'right': 'right',
        'unknown': None,
        'upbackleft': 'backleft',
        'upbackright': 'backright',
        'upfrontleft': 'frontleft',
        'upfrontright': 'frontright',
        'upleft': 'left',
        'upright': 'right',
    },
}
INFO:wbia:flip mapping = {
    'backleft': 'backright',
    'backright': 'backleft',
    'frontleft': 'frontright',
    'frontright': 'frontleft',
    'left': 'right',
    'right': 'left',
}
INFO:wbia:Filtered annotations: keep 7658 / original 11773
INFO:wbia:Null yaws: 515
INFO:wbia:Requested categories:
category_set = [
    'zebra_grevys',
]
INFO:wbia:Valid yaw categories:
valid_yaw_set = [
    'zebra_grevys',
]
INFO:wbia:Invalid seen categories (could not fulfill request):
invalid_seen_set = []
INFO:wbia:Yaw:  skipped 515 / total 7658
INFO:wbia:Seen: skipped 0 / total 7658
INFO:wbia:Flipped: 3569 / total 7143
INFO:wbia:Making folder for 'zebra_grevys:back'
INFO:wbia:Making folder for 'zebra_grevys:backleft'
INFO:wbia:Making folder for 'zebra_grevys:backright'
INFO:wbia:Making folder for 'zebra_grevys:front'
INFO:wbia:Making folder for 'zebra_grevys:frontleft'
INFO:wbia:Making folder for 'zebra_grevys:frontright'
INFO:wbia:Making folder for 'zebra_grevys:left'
INFO:wbia:Making folder for 'zebra_grevys:right'
INFO:wbia.dtool:[deptbl.compute] nInput=7143, chunksize=256, tbl=chips
0it [00:00, ?it/s][deptbl.compute] add chips chunk    0/28...

INFO:wbia:Preprocess Chips
...
```

#### Train Background Segmentation

```python
>>> ibs.background_train(
>>>     'zebra_grevys',
>>>     train_gid_set=train_gid_list,
>>>     global_limit=100000
>>> )
INFO:root:/data/db/_ibsdb/_ibeis_cache/extracted
INFO:root:Processing GID: 4436 [ 0 / 0 = 0]
INFO:root:      AIDS  : [1163, 1164]
INFO:root:      BBOXES: [(499, 327, 1927, 1613), (2339, 689, 251, 462)]
INFO:root:Processing GID: 3365 [ 60 / 60 = 120]
INFO:root:      AIDS  : [4418, 4419]
INFO:root:      BBOXES: [(0, 379, 177, 173), (24, 368, 1487, 1303)]
INFO:root:Skipping aid 4418 (bad species: zebra_plains)
INFO:root:Processing GID: 1768 [ 90 / 90 = 180]
INFO:root:      AIDS  : [830]
INFO:root:      BBOXES: [(1842, 1739, 1684, 983)]
INFO:root:Processing GID: 364 [ 120 / 120 = 240]
INFO:root:      AIDS  : [5190]
INFO:root:      BBOXES: [(1985, 441, 1138, 2530)]
INFO:root:Skipping aid 5190 (bad species: giraffe_reticulated)
INFO:root:Processing GID: 588 [ 120 / 120 = 240]
INFO:root:      AIDS  : [8392]
INFO:root:      BBOXES: [(2, 858, 4430, 2590)]
INFO:root:Processing GID: 862 [ 150 / 150 = 300]
INFO:root:      AIDS  : [13937]
INFO:root:      BBOXES: [(0, 569, 3559, 2129)]
INFO:root:Processing GID: 2635 [ 180 / 180 = 360]
INFO:root:      AIDS  : [77]
INFO:root:      BBOXES: [(627, 785, 2396, 1396)]
INFO:root:Processing GID: 1867 [ 210 / 210 = 420]
INFO:root:      AIDS  : [15289, 15290, 15291, 15292, 15293, 15294, 15295, 15296, 15297, 15298]
INFO:root:      BBOXES: [(0, 832, 855, 1931), (726, 1074, 1708, 1584), (1275, 1169, 2980, 1708), (2414, 1134, 312, 188), (2578, 1112, 570, 243), (2701, 1080, 295, 106), (2968, 1073, 580, 338), (3513, 1154, 260, 215), (3900, 1186, 352, 538), (450
9, 1172, 96, 317)]
INFO:root:Skipping aid 15292 (bad species: zebra_plains)
INFO:root:Skipping aid 15296 (bad species: zebra_plains)
INFO:root:Skipping aid 15297 (bad species: zebra_plains)
INFO:root:Skipping aid 15298 (sanity check)
INFO:root:Skipping aid 15298 (not found)
...
```
