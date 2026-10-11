import { type DemoPageItemType } from "@/types";

const DEMO_PAGE_ITEMS = [
  {
    title: "Login standard",
    slug: "001-login-standard",
    hasScreenshot: true,
  },
  {
    title: "Login social buttons column below divider",
    slug: "002-login-social-buttons-column-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Login social buttons column above divider",
    slug: "003-login-social-buttons-column-above-divider",
    hasScreenshot: true,
  },
  {
    title: "Login social buttons row below divider",
    slug: "004-login-social-buttons-row-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Login social icon buttons row below divider",
    slug: "005-login-social-icon-buttons-row-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Login social icon buttons grid below divider",
    slug: "006-login-social-icon-buttons-grid-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Login combined card",
    slug: "007-login-combined-card",
    hasScreenshot: true,
  },
  {
    title: "Login separated card",
    slug: "008-login-separated-card",
    hasScreenshot: true,
  },
  {
    title: "Login split card",
    slug: "009-login-split-card",
    hasScreenshot: true,
  },
  {
    title: "Login remember",
    slug: "010-login-remember",
    hasScreenshot: true,
  },
  {
    title: "Login minimal",
    slug: "011-login-minimal",
    hasScreenshot: true,
  },
  {
    title: "Login split",
    slug: "012-login-split",
    hasScreenshot: true,
  },
  {
    title: "Signup standard",
    slug: "013-signup-standard",
    hasScreenshot: true,
  },
  {
    title: "Signup password checklist",
    slug: "014-signup-password-checklist",
    hasScreenshot: true,
  },
  {
    title: "Signup confirm password",
    slug: "015-signup-confirm-password",
    hasScreenshot: true,
  },
  {
    title: "Signup social button without divider",
    slug: "016-signup-social-button-without-divider",
    hasScreenshot: true,
  },
  {
    title: "Signup social buttons row below divider",
    slug: "017-signup-social-buttons-row-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Signup social icon buttons row below divider",
    slug: "018-signup-social-icon-buttons-row-below-divider",
    hasScreenshot: true,
  },
  {
    title: "Signup combined card",
    slug: "019-signup-combined-card",
    hasScreenshot: true,
  },
  {
    title: "Signup separated card",
    slug: "020-signup-separated-card",
    hasScreenshot: true,
  },
  {
    title: "Signup split card",
    slug: "021-signup-split-card",
    hasScreenshot: true,
  },
  {
    title: "Signup marketing checkbox",
    slug: "022-signup-marketing-checkbox",
    hasScreenshot: true,
  },
  {
    title: "Signup minimal",
    slug: "023-signup-minimal",
    hasScreenshot: true,
  },
  {
    title: "Signup split",
    slug: "024-signup-split",
    hasScreenshot: true,
  },
  {
    title: "Sidebar standard left",
    slug: "025-sidebar-standard-left",
    hasScreenshot: true,
  },
  {
    title: "Sidebar inset left",
    slug: "026-sidebar-inset-left",
    hasScreenshot: true,
  },
] as const satisfies Omit<DemoPageItemType, "href">[];

export const DEMO_PAGES = DEMO_PAGE_ITEMS.map((page) => ({
  ...page,
  href: `/demos/${page.slug}`,
}));
