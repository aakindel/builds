import { type DemoPageItemType } from "@/types";

const DEMO_PAGE_ITEMS: Omit<DemoPageItemType, "href">[] = [];

export const DEMO_PAGES: DemoPageItemType[] = DEMO_PAGE_ITEMS.map((page) => ({
  ...page,
  href: `/demos/${page.slug}`,
}));
