module.exports = {
  researcherSidebar: {
    Codex: [
      "researchers/codex/codex-firstlogin",
      {
        "type": "category",
        "label": "Introduction",
        "items": [
          "researchers/codex/codex-introduction",
          "researchers/codex/codex-standardreporting",
          "researchers/codex/bulk_reporting",
          "researchers/codex/codex-imageanalysis"
        ]
      },
      {
        "type": "category",
        "label": "Data",
        "items": [
          "researchers/codex/codex-data",
          "researchers/codex/codex-dataformat",
          "researchers/codex/codex-datasearch",
          "researchers/codex/codex-datamatch"
        ]
      },
      {
        "type": "category",
        "label": "Security",
        "items": [
          "researchers/codex/codex-security",
          "researchers/codex/codex-securityoverview",
          "researchers/codex/codex-securitymyaccount",
          "researchers/codex/codex-securitycollaborations"
        ]
      },
      {
        "type": "category",
        "label": "Set Up",
        "items": [
          "researchers/codex/codex-setup",
          "researchers/codex/codex-systemrequirements",
          "researchers/codex/codex-initialconfiguration",
          {
            "type": "category",
            "label": "Control Panel",
            "items": [
              "researchers/codex/codex-controlpanel",
              "researchers/codex/codex-controlpanel-generalsettings",
              "researchers/codex/codex-controlpanel-splashpage",
              "researchers/codex/codex-controlpanel-managefields",
              "researchers/codex/codex-controlpanel-sitestatus",
              "researchers/codex/codex-controlpanel-generalsettings"
            ]
          },
          {
            "type": "category",
            "label": "Manage Users",
            "items": [
              "researchers/codex/codex-controlpanel-manageusers",
              "researchers/codex/codex-controlpanel-manageusers-dataroles",
            ]
          },
          "researchers/codex/codex-controlpanel-administration",

        ]
      },
      "researchers/codex/codex-faq"
    ],

    Scout: [
    "researchers/scout/who-should-read",
      {
        "type": "category",
        "label": "System Admin: System Set Up",
        "items": [
          "researchers/scout/system-requirements",
          "researchers/scout/system-installation",
          "researchers/scout/scout-install-setup"
        ]
      },
      {
        "type": "category",
        "label": "Lab Lead: Scout Configuration",
        "items": [
          "researchers/scout/first-scout-login",
          "researchers/scout/manage-users",
          "researchers/scout/manage-tasks",
          "researchers/scout/ground-truth",
          "researchers/scout/draw-division-lines",
          "researchers/scout/export-data",
          "researchers/scout/evaluate-performance"
        ]
      },
      {
        "type": "category",
        "label": "All Users: Image Annotation",
        "items": [
          "researchers/scout/log-in",
          "researchers/scout/find-tasks",
          "researchers/scout/annotate-images"
        ]
      },
      "researchers/scout/support-faq"
    ],
    
    Wildbook: [
      {
        "type": "category",
        "label": "Introduction",
        "items": [
          "researchers/overview",
          "researchers/ia_pipeline",
          "researchers/data_entry",
          "researchers/encounter_guide",
          "researchers/marked_individual",
          "researchers/sighting",
          "researchers/security_overview",
          "researchers/whatsnew",
          "researchers/faq",
        ]
      },
      "researchers/firstlogin",
      {
        "type": "category",
        "label": "Data",
        "items": [
          "researchers/photography_guidelines",
          "researchers/report_encounter",
          "researchers/bulk_import",
          "researchers/matching_process",
          "researchers/manual_annotation",
          "researchers/searching",
          "researchers/projects",
          "researchers/locationID",
          "researchers/r_package",
        ]
      },
      {
        "type": "category",
        "label": "Security",
        "items": [
          "researchers/security_overview",
          "researchers/my_account",
          "researchers/silo_security",
          "researchers/org_admin",
          "researchers/site_admin",
        ]
      },
      {
        "type": "category",
        "label": "Specifications",
        "items": [
          "researchers/system_requirements",
          "researchers/unsupported_developer_tools",
          "researchers/configuration",
        ]
      }
    ],
    "Wildbook IA": [
      "researchers/wbia/wbia_ggr"
    ]
  },
  developerSidebar: {
    Introduction: [
      "developers/overview",
      "developers/terms",
      "developers/datetime",
      "developers/faq",
    ],
    Wildbook: [
      "developers/wildbook_overview",
      {
        type: "link",
        label: "Azure Wildbook setup",
        href:
          "https://docs.google.com/document/d/1o1BDHzf2FV-LTShPLgqoNJBLJnQN-tfe50lHlm92qX8/edit#heading=h.1ylnnzcj18n1",
      },
    ],
    "Wildbook IA (WBIA)": [
      "developers/wbia/wbia_overview",
      "developers/wbia/wbia_pipeline",
      "developers/wbia/wbia_plugins"
    ],
    Codex: [
      "developers/codex_overview",
      "developers/houston",
      "developers/elasticsearch",
      "developers/codex_frontend",
      "developers/debugging",
      {
        type: "category",
        label: "EDM API",
        items: [
          "developers/edmapi/edm_api_overview",
          "developers/edmapi/authentication",
          "developers/edmapi/user",
          "developers/edmapi/assets",
          "developers/edmapi/encounter",
          "developers/edmapi/individual",
          "developers/edmapi/org",
          "developers/edmapi/site_settings",
        ],
      },
    ],
  },
};
