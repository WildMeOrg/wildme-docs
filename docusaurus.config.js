module.exports = {
  title: "Wild Me Docs",
  tagline: "Documentation for Wildbook, Codex, and other Wild Me software.",
  url: "https://docs.wildme.org",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "WildMeOrg", // Usually your GitHub org/user name.
  projectName: "wildme-docs", // Usually your repo name.
  themeConfig: {
    algolia: {
      apiKey: "d7ed0de7b37ad70fdd0b8213f5e5e1c1",
      appId: "CI1FXFSI2S",
      indexName: "wildme",
    },
    colorMode: {
      disableSwitch: true,
    },
    navbar: {
      title: "Wild Me Docs",
      logo: {
        alt: "Wild Me Logo",
        src: "img/WildMe-Logo-Gradient.svg",
      },
      items: [
        {
          to: "docs/researchers/overview",
          activeBasePath: "docs",
          label: "Researchers",
          position: "left",
        },
        {
          to: "docs/developers/overview",
          activeBasePath: "docs",
          label: "Developers",
          position: "left",
        },
        {
          href: "https://github.com/WildMeOrg/wildme-docs",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Researchers",
          items: [
            {
              label: "Researcher Overview",
              to: "docs/researchers/overview",
            },
            {
              label: "Encounter guide",
              to: "docs/researchers/encounter_guide",
            },
            {
              label: "Marked individual",
              to: "docs/researchers/marked_individual",
            },
          ],
        },
        {
          title: "Developers",
          items: [
            {
              label: "Developer Overview",
              to: "docs/developers/overview",
            },
            {
              label: "Wildbook",
              to: "docs/developers/wildbook_overview",
            },
            {
              label: "Codex",
              to: "docs/developers/codex_overview",
            },
          ],
        },
        {
          title: "Connect",
          items: [
            {
              label: "wildme.org",
              to: "https://www.wildme.org/",
            },
            {
              label: "GitHub",
              href: "https://github.com/WildMeOrg",
            },
            {
              label: "Twitter",
              href: "https://twitter.com/wildmeorg",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Wild Me.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl: "https://github.com/WildMeOrg/wildme-docs/edit/main/",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            "https://github.com/WildMeOrg/wildme-docs/edit/main/website/blog/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        googleAnalytics: {
          trackingID: "UA-30944767-19",
          anonymizeIP: true,
        },
      },
    ],
  ],
};
