---
id: bulk_import
title: Bulk import (beta)
---

To allow for the integration and import of legacy data as well as batched volumes of data, Wildbook provides a system for uploading a large amount of data called Bulk Import. Bulk Import allows users with login privileges to provide photos and related metadata (e.g., date, location, species, etc.) *en masse*.

_Note: this functionality is in beta. This feature can be considered largely stable. Any substantial changes will be reported out before they take place._

## How to use 

There are two pieces of input required for a bulk import: 

- photo archive in a local file system
- Excel spreadsheet linking photos to metadata

In setting up your bulk imports, ensure that each import has no more than 1000 encounters.

### Photo archive set-up

On your computer, organize the photos you'd like to upload into a single folder.

1. Create a folder.
2. Move all images you intend to upload to the folder.
3. Ensure that all file names are distinct.

If you have file names that are the same, either rename the duplicates or upload the duplicates in a separate batch.

Remember, the image names must correspond exactly to the "Encounter.MediaAsset" entries in your Wildbook Standard Format spreadsheet. Special characters are removed from file names. File names must be unique, even with special characters removed. We recommend removing special characters before uploading to check for potential collisions.

### Spreadsheet set-up

In the header of an excel or csv file, create a column for each field you want to upload to Wildbook. [See Fields Available for a list of supported fields.](#fields-available) This must include at least:

1. a location reference (Encounter.verbatimLocality, Encounter.locationID, and/ or Encounter.decimalLatitude and Encounter.decimalLongitude)
2. a date and time reference (Encounter.year, Encounter.month, Encounter.day, etc.) to the most granular available)
3. photograph reference (Encounter.MediaAsset*X*)
4. Taxonomy (Encounter.genus and Encounter.specificEpithet)

All other fields are optional. Because this flow is only accessible to authorized users, the encounters are uploaded as approved encounters if Encounter.state is not otherwise set.

Here are important guidelines for preparing your spreadsheet.

- Determine which columns you have data for (see [Fields Available](#fields-available)). It is OK to add, remove, and reorder columns as needed from the provided list. You can create your own version of our spreadsheet as long as you do not change the header names.
- Fill out each line for a single [Encounter](encounter_guide.md). If an encounter is associated with a [Sighting](sighting.md) (or Occurrence), include the needed information for the sighting on at least one line of an associated encounter.
- If leveraging any of the Sighting/Occurrence fields, ensure that each encounter is linked with a common value in the Occurrence.occurenceID column.
- Verify the following fields match exactly what exists in the system:
    -    Encounter.submitterID - your User account's username to ensure the Encounter is credited to your User account.
    -    Encounter.mediaAsset*X* - this is the exact file name of each image of the Encounter. *X* starts numbering at 0, and for each image is incremented by 1. 0, 1, 2, 3, etc.

### Spreadsheet templates by use case 

Here are example Bulk Import Excel spreadsheet templates.

[Minimum import](../../static/resources/minimum_import.xlsx)

[Individual catalog](../../static/resources/individual_catalog_import.xlsx)

[Sighting import](../../static/resources/sighting_import.xlsx)

### Upload

When you have finished preparations, navigate to your Wildbook's Bulk Import page (import/instructions.jsp) and begin the guided walk-through.

1. Select **Upload Photos**.
2. Browse to your photo directory and select **Upload**.
3. Select **Begin Upload** to be taken to the photo review page. At this point, these images are uploaded to the platform and available.
4. Review that all photos you have uploaded are available in the import. If they are, select **Accept** and move on.
5. Browse to your spreadsheet and select **Open**.
6. Select **Begin Upload** to be taken to the import overview.
7. Review the data preview for data integrity. _Note that the system will verify the data in the spreadsheet against ALL images you have in the system, not only the ones you are currently uploading. Review the online data integrity report carefully before initiating an upload._

If everything looks as expected, select **Commit these results** and confirm that you want to import all data.

### Matching Process

After bulk import, you can send imported encounters through the [Image Analysis Pipeline](ia_pipeline.md) if the pipeline is configured for the imported species.

Once the import completes, you can take these actions:

**Send to detection (no identification)**: The MediaAssets you have uploaded are sent to Detection, where annotations are added for each animal found by the [Image Analysis Pipeline](ia_pipeline.md). Identification can be run later individually through each Encounter page. See [Matching Process](matching_process.md) for more information.

**Send to identification**: The MediaAssets you have uploaded are sent through Detection, and any found Annotations are sent on to the Identification process.

Bulk Detection and Identification can very significantly impact the Wildbook Image Analysis queue oh machine learning jobs. Other users can expect slowdowns waiting for bulk Detection and ID jobs to finish.

### Deleting a Bulk Import

Mistakes happen. If you find systematic problems in the data of a Bulk Import job, you can return to the Bulk Import log page and click **Delete ImportTask** at the bottom, which will remove all of the imported data. You can now fix your data and reimport to Wildbook.

## Fields available

The most commonly-used fields are listed in the table below.


| Name                          | Type      | Example Value                                                                        | Description                                                                                                                                                                                                                                                                                         |
|-------------------------------|-----------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| MarkedIndividual.individualID | V_WString | Lion045                                                                              | PrimaryKey; serves same purpose as Encounter.individualID. While Wildbook assigns UUIDs to MarkedIndividuals, this field becomes the default display name for the MarkedIndividual.                                                                                                                 |
| Encounter.verbatimLocality    | V_WString | Saw this about five minutes into our tour near mile marker 5, somewhere in Tanzania. | Long descriptive string to reference location; no constraints on what is entered, but is not used for analysis                                                                                                                                                                                      |
| Encounter.locationID          | V_WString | Zone 5, Botswana                                                                     | Hierarchical list of study sites; allows for consistency and controlled granularity of location input                                                                                                                                                                                               |
| Encounter.decimalLatitude     | Double    | -35.46                                                                               | Enter latitude coordinates using decimals instead of degrees, minutes, and seconds (DMS). The first encounter of any setting will also set the decimal latitude at the sighting/occurrence level.|
| Encounter.decimalLongitude    | Double    | 54.678                                                                               | Enter longitude coordinates using decimals instead of degrees, minutes, and seconds (DMS). The first encounter of any setting will also set the decimal latitude at the sighting/occurrence level.             |
| Encounter.year                | Int32     | 2020                                                                                 | For encounter date information, add what you have to greatest degree of accuracy. Storing the segments separately allows general dates such as "june 2014"; we do not store seconds or milliseconds for an encounter's date information, so there are no fields to allow the input of those values. Enter a 4 digit number | Encounter.month               | Int32     | 5                                                                                    | Enter a number 1-12, 1 corresponding with January.                                                                                                                                                                                                                                                  |
| Encounter.day                 | Int32     | 24                                                                                   | Enter a number 1-31 corresponding with the day of the month.                                                                                                                                                                                                                                        |
| Encounter.mediaAssetX         | String    | 20180905/12345.jpg                                                                   | Must be entered exactly: relative path to the photo from the position of the imported spreadsheet on the file system. Values of "X" from 0 to infinity are iterated until a sequence value is not found.                                                                                            |
| Encounter.genus               | V_WString | Panthera                                                                             | Enter an option from the Taxonomy dropdown. This should be the first of the two phrases. If entered incorrectly, Taxonomy will display as "Not Available".                                                                                                                                          |
| Encounter.specificEpithet     | V_WString | pardus                                                                               | Enter an option from the Taxonomy dropdown. This should be the second of the two phrases. If entered incorrectly, Taxonomy will display as "Not Available".                                                                                                                                         |
| Encounter.submitterID         | V_WString | tmcnutt                                                                              | assumes User with username matching this value                                                                                                                                                                                                                                                      |
| Encounter.state               | V_WString | approved, unapproved, unidentifiable                                                                             | The curation state of this Encounter. Default value if left blank is "approved". Uncurated data should be imported as "unapproved". Encounters without photos should be imported as "unidentifiable". Note that these entries are case-sensitive.                                                                                                                                                                                                                                             |

The follow fields can be included when uploading an encounter. Review the intent of the field and validate that it is in use in your system (meaning if you are on a terrestrial Wildbook, you will likely not leverage Encounter.depth).

| Name                                                         | Type      | Example Value                                                | Description                                                  |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Encounter.behavior                                           | V_WString | feeding                                                      | List of behaviors commonly observed in the species           |
| Encounter.country                                            | V_WString | Botswana                                                     | Country in which the encounter took place                    |
| Encounter.dateInMilliseconds                                 | Int64     | 1589554848                                                   | Skip other encounter date fields if you have a precise datetime (milliseconds since epoch---the standard computer format for datetimes). Format is a large integer like 1516685992499 |
| Encounter.distinguishingScar                                 | V_WString | left body                                                    | Description of any highly-identifiable markings/scarring that help with visual identificaton |
| Encounter.groupRole                                          | V_WString | escort male                                                  | Not commonly used. Largely used for point-in-time observations of role rather than longer-term observations. |
| Encounter.hour                                               | Int32     | 11                                                           | Enter a number 1-24, 24 corresponding with midnight.         |
| Encounter.individualID                                       | V_WString | Lion045                                                      | duplicate of MarkedIndividual.individualID.Either can be used. Value is translated into the Default name of the individual. |
| Encounter.keywordX                                           | String    | left strange marking                                         | Applies a keyword to a mediaAsset; the number of Encounter.keyword(X) should correspond to number of Encounter.mediaAsset(X). |
| Encounter.mediaAssetX.keywords                               | String    | left strange marking_scar on body_ProfilePhoto               | If multiple keywords need to be imported per MediaAsset, use Encounter.mediaAssetX.keywords. Values of "X" from 0 to infinity are iterated until a sequence value is not found. Multiple keywords are separated by an underscore _. |
| Encounter.lifeStage                                          | V_WString | juvenile                                                     | List of potential life stages, standards are adult, juvenile, unknown |
| Encounter.depth                                              | Double    | 35                                                           | Marine-based: depth of water that the encounter occurred at  |
| Encounter.identificationRemarks                              | String    |                                                              | Accepted values: "Unmatched first encounter", "Visual inspection", and "pattern match" |
| Encounter.livingStatus                                       | V_WString |                                                              | Accepted values: "alive"/"dead"                              |
| Encounter.measurementX                                       | String    | 5                                                            | Supported column headings are numeric (e.g., Encounter.measurement0) and follow their exact sequence as configured in commonConfiguration.properties. Values of "X" from 0 to infinity are iterated until a sequence value is not found. |
| Encounter.mediaAssetX.keywords                               | String    | left strange marking, missing eye                            | Underscore-delimited list of keywords to be associated with the MediaAsset. Can be used for one or many keywords. Values of "X" from 0 to infinity are iterated until a sequence value is not found. |
| Encounter.mediaAssetX.[label name]                           | String    | [label name]: flukeType, value: dorsal                       | Name a column for a labelled keyword and provide an associated value for each encounter. Labelled keyword names can be found in the keyword dropdown on a MediaAsset. Labelled keywords can be defined in the commonConfiguration.properties file. |
| Encounter.minutes                                            | V_WString | 35                                                           | Enter a number 1-60.                                         |
| Encounter.occurrenceID                                       | V_WString | BPCT_20190825_1                                              | A unique code that links encounters across a single occurrence/sighting. Helpful if you can cross-reference to your records; if you enter an ID that exists in the system, the encounter will be associated with the existing sighting/occurrence. If you enter a new and unique ID or if you leave the field blank, a new sighting/occurrence will be created and the encounter associated with the newly created sighting/occurrence. Restricted to latin alphanumeric characters (a-z, A-Z, 0-9), - and _.  Duplicates Occurrence.occurrenceID |
| Encounter.occurrenceRemarks                                  | V_WString | We saw this pack while driving through the forest.           | Unconstrained field allowing for general documentation of noteworthy aspects of an occurrence/sighting |
| Encounter.otherCatalogNumbers                                | V_WString | fieldObs12                                                   | Links the Encounter to other numbers, such as a field encounter number for the day. Limited use in Wildbook. |
| Encounter.patterningCode                                     | V_WString | tan                                                          | A code that defines some standardized feature of body coloring, such as how humpback whale flukes are categorized 1-5 (light to dark) or ild dogs are categorized by general body color (e.g., tan). This field is stored on the back-end and displayed without UI editing capability. |
| Encounter.informOtherX.affiliation                           | String    | BPCT                                                         | Unconstrained string to indicate an affiliation for the other to inform is associated with. Values of "X" from 0 to infinity are iterated until a sequnce value is not found. |
| Encounter.informOtherX.emailAddress                          | String    | joe@joe.com                                                  | Indicate the email of someone else to inform of Encounter updates. Values of "X" from 0 to infinity are iterated until a sequnce value is not found. |
| Encounter.informOtherX.fullName                              | String    | Joe Smith                                                    | Provide the full name of someone else to inform of Encounter updates. Values of "X" from 0 to infinity are iterated until a sequnce value is not found. |
| Encounter.photographerX.affiliation                          | String    | BPCT                                                         | Unconstrained string to indicate an organization the provider of the photograph is associated with. Values of "X" from 0 to infinity are iterated until a sequence value is not found. Does not save unless photographerX.emailAddress is also reported. |
| Encounter.photographerX.emailAddress                         | String    | joe@joe.com                                                  | Indicate the email of the photographer. Values of "X" from 0 to infinity are iterated until a sequence value is not found. |
| Encounter.photographerX.fullName                             | String    | Joe Smith                                                    | Provide the full name of the photographer. Values of "X" from 0 to infinity are iterated until a sequence value is not found. Does not save unless photographerX.emailAddress is also reported. |
| Encounter.projectX.projectIdPrefix                           | String    | Cen20-                                                       | The prefix used when assigning project IDs to encounters; note that these values are case sensitive. Values of "X" from 0 to infinity are iterated until a sequence value is not found, allowing you to put encounters. Required for imports into existing and new projects. into multiple projects. |
| Encounter.projectX.researchProjectName                       | String    | Census 2020                                                  | The project's name; note that these values are case sensitive. Values of "X" from 0 to infinity are iterated until a sequence value is not found, allowing you to put encounters into multiple project. Required for imports into both existing and new projects |
| Encounter.projectX.ownerUsername                             | String    | censusadmin                                                  | The username of the person who should manage the project; note that these values are case sensitive. Required for imports into new projects only. To ensure no caching or threading issues, the owner should be associated with all encounters in the spreadsheet that are going into the new project. |
| Encounter.mediaAssetX.quality                                | String    | An integer value 0 to 4.                                     | Estimated quality of Encounter.mediaAssetX. Values of "X" from 0 to infinity are iterated until a sequence value is not found. |
| Encounter.researcherComments                                 | V_WString | We also took a separate video observation.                   | Unconstrained field allows for general notes regarding the specific encounter (single annotation and related metadata) |
| Encounter.sex                                                | V_WString | male                                                         | Focus on values: male, female, unknown                       |
| Encounter.submitterX.affiliation                             | String    | Joe's Safaris                                                | Unconstrained string to indicate an organization the encounter submitter is associated with. Values of "X" from 0 to infinity are iterated until a sequence value is not found. Does not save unless submitterX.emailAddress is also reported. |
| Encounter.submitterX.emailAddress                            | String    | joe@joe.com                                                  | Indicate the email of the encounter submitter. Values of "X" from 0 to infinity are iterated until a sequence value is not found. |
| Encounter.submitterX.fullName                                | String    | Joe Smith                                                    | Provide the full name of the encounter submitter. Values of "X" from 0 to infinity are iterated until a sequence value is not found. Does not save unless submitterX.emailAddress is also reported. |
| MarkedIndividual.nickname                                    | V_WString | Barry the Slow Lion                                          | Enter a name that can be more easily referenced; does not override ID. |
| Membership.role                                              | V_WString | alpha                                                        | role as a Member of a SocialUnit                             |
| Occurrence.bearing                                           | Double    | 45                                                           | value to work with decimalLatitude, decimalLongitude, and distance of sighting. Typically aquatic-only |
| Occurrence.bestGroupSizeEstimate                             | Double    | 5                                                            | Researcher-provided estimate of group size                   |
| Occurrence.comments                                          | V_WString |                                                              | unconstrained string to allow for free-form researcher commentary about the sighting. |
| Occurrence.distance                                          | Double    |                                                              | value to work with decimalLatitude, decimalLongitude, and bearing of sighting |
| Occurrence.effortCode                                        | Double    |                                                              | Categorized set of values denoting the amount of effort that went into collecting data for a Sighting/Occurrence |
| Occurrence.fieldStudySite                                    | V_WString |                                                              | string to allow entry of location; site names should be recognizable |
| Occurrence.fieldSurveyCode                                   | V_WString |                                                              | string to be associated with a given Survey                  |
| Occurrence.groupBehavior                                     | V_WString |                                                              | string to allow for general description of observed behavior |
| Occurrence.groupComposition                                  | V_WString |                                                              | string to allow for general description of what animals are observed and their potential relationships |
| Occurrence.humanActivityNearby                               | V_WString |                                                              | description of any activity known to occur in the area       |
| Occurrence.individualCount                                   | Int32     |                                                              | Number of individuals counted manually in the sighting/occurrence. |
| Occurrence.initialCue                                        | V_WString |                                                              | Text value denoting what signalled attention to the Sighting/Occurrence. Stored in the database only. No UI. |
| Occurrence.maxGroupSizeEstimate                              | Int32     |                                                              | Researcher-provided estimate of upper limit group size       |
| Occurrence.millis                                            | Int64     |                                                              | Time of the Sighting/Occurrence in milliseconds since Epoch; typically originates from hardward used to capture image |
| Occurrence.minGroupSizeEstimate                              | Int32     |                                                              | Researcher-provided estimate of lower limit group size       |
| Occurrence.numAdults                                         | Int32     |                                                              | Researcher-provided determination of number of adults        |
| Occurrence.numCalves                                         | Int32     |                                                              | Researcher-provided determination of number of calves; can be used for any infant stage of a species |
| Occurrence.numJuveniles                                      | Int32     |                                                              | Researcher-provided determination of number of juveniles     |
| Occurrence.occurrenceID                                      | V_WString |                                                              | PrimaryKey; unique to each sighting. Helpful if you can cross-reference to your records; if you enter an ID that exists in the system, the encounter will be associated with the existing sighting/occurrence. If you enter a new and unique ID or if you leave the field blank, a new sighting/occurrence will be created and the encounter associated with the newly created sighting/occurrence. Restricted to latin alphanumeric characters (a-z, A-Z, 0-9), - and _. Duplicates Encounter.occurrenceID |
| Occurrence.seaState                                          | V_WString |                                                              | description of water conditions during sighting. Aquatic-only |
| Occurrence.seaSurfaceTemp                                    | Double    |                                                              | temperature of water; degrees celcius. Aquatic-only          |
| Occurrence.swellHeight                                       | Double    |                                                              | height of any waves in the area; meters. Aquatic-only        |
| Occurrence.transectBearing                                   | Double    |                                                              | Numeric value of the bearing from the observation vessel to the observed Sighting/Occurence. Stored in database only. |
| Occurrence.transectName                                      | V_WString |                                                              | Name of the transect that logged the sighting/Occurence. Stored in the database only. |
| Occurrence.visibilityIndex                                   | Double    |                                                              | Indexed values of the visibility during the time of the sighting/Occurrence. Stored in the database only. |
| SatelliteTag.serialNumber                                    | V_WString | 12345                                                        | serial Number; reference only                                |
| SocialUnit.socialUnitName                                    | V_WString | G Pack                                                       | PrimaryKey; unique to each social unit                       |
| Survey.comments                                              | V_WString | Transect45                                                   | unconstrained field to allow for researcher notes about a Survey |
| SurveyTrack.vesselID                                         | V_WString | Car 45                                                       | user-provided identifier of ship used during Survey          |
| TissueSample.sampleID                                        | V_WString | 12345                                                        | ID of the Tissue Sample taken during this Encounter. Only one TissueSample can be imported per Encounter. |
| SexAnalysis.sex                                              | V_WString | female                                                       | Determination from a genetic analysis of the individual's sex. Results from analysis of a Tissue Sample taken during the same Encounter. A corresponding TissueSample.sampleID entry is required for this field to import. |
| MitochondrialDNAAnalysis.haplotype                           | V_WString | "A+"                                                         | Determination from a genetic analysis of the individual's haplotype. Results from analysis of a Tissue Sample taken during the same Encounter. A corresponding TissueSample.sampleID entry is required for this field to import. |
| MicrosatelliteMarkersAnalysis.alleleNames<br />MicrosatelliteMarkersAnalysis.alleles0<br />MicrosatelliteMarkersAnalysis.alleles1 | V_WString | alleleNames:<br />"EV1,EV5,EV94,GT23,GT575,rw410,464465,GATA417,SW13,EV37,EV14,FCB1,SW19"<br /><br />alleles0:<br />"120,154,201,79,131,177,140,182,158,231,125,121,123"<br /><br />alleles1:<br />"120,158,209,85,135,183,140,186,160,237,145,129,147" | Determination from a genetic analysis of the individual's genotype. Results from analysis of a Tissue Sample taken during the same Encounter. A corresponding TissueSample.sampleID entry is required for this field to import. These three fields must all be present and have the exact same number of values as separated by commas. |

## Reviewing Bulk Imports

You can review your Bulk Imports by selecting **Bulk Import Logs** from the **Administer** menu. If you have admin or orgAdmin roles on your User account, you may see additional logs for other users as well.

## FAQ

### What Excel file formats are supported? 

.xlsx only

### I found other fields in the database, but they don't work when I try to use them in the importer.

There are a number of additional fields that cannot be set using the Bulk Import capability.

### I made a mistake and want to reload my encounters.

You can delete and reimport your data. [See Deleting a Bulk Import for more information.](#deleting-a-bulk-import)

### I uploaded the wrong image, but when I clicked back to try again, the image was still listed.

The list displays all images uploaded. You can navigate to the image in the platform and remove it.

### How do I associate multiple images with a single encounter?
You can add a virtually infinite number of images with a single encounter using the Encounter.mediaAssetX field. For each photo you want to associate with a given encounter, create an Encounter.mediaAssetX column, starting with X=0.

|Encounter.mediaAsset0|Encounter.mediaAsset1|Encounter.mediaAsset2|
|-|-|-|
|photo1.png|photo2.png|photo3.png|

### I want to set photographerX.affiliation or photographerX.fullName without providing an email address.

At present, there is no way to provide this information without providing an email address because these fields are tied into the system user management.

To work around this, you can provide an email that is used system-wide for all submissions that don't have an email associated (e.g., if you have a photograph submitted by a tourist through an external site, you can reference an email associated with the site along with the tourist's name). This is also true for submitterX.affiliation and submitterX.fullName.
