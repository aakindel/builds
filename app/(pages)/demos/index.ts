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
] as const satisfies Omit<DemoPageItemType, "href">[];

export const DEMO_PAGES = DEMO_PAGE_ITEMS.map((page) => ({
  ...page,
  href: `/demos/${page.slug}`,
}));
