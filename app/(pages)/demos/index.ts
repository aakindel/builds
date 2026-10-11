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
] as const satisfies Omit<DemoPageItemType, "href">[];

export const DEMO_PAGES = DEMO_PAGE_ITEMS.map((page) => ({
  ...page,
  href: `/demos/${page.slug}`,
}));
