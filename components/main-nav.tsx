import Link from "next/link";
import { cn } from "@/utils";
import { buttonVariants } from "@/components/ui/button/button-variants";
import {
  APP_VARIABLE_CLASS,
  APP_VARIABLE_CLASSES,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_HEIGHT_CLASS,
} from "@/components/alignment";
import {
  TOPBAR_BORDER_THICKNESS,
  TOPBAR_BORDERLESS_HEIGHT,
} from "@/app/constants";
import { ThemeToggle } from "./theme-toggle";

const MAIN_NAV_ITEMS = [{ title: "Demos", href: "/demos" }] as const;

const MainNavLinks = () => {
  return MAIN_NAV_ITEMS.map((item) => {
    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "border border-transparent px-3 text-sm leading-6 font-medium",
          "text-subdued hover:text-subdued!"
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.title}
      </Link>
    );
  });
};

export const MainNav = () => {
  return (
    <header
      className="bg-background flex shrink-0 items-center justify-end border-transparent px-4"
      style={{
        height: `${TOPBAR_BORDERLESS_HEIGHT}px`,
        borderBottomWidth: `${TOPBAR_BORDER_THICKNESS}px`,
      }}
    >
      <div className="flex items-center gap-2">
        <MainNavLinks />
        <ThemeToggle />
      </div>
    </header>
  );
};

/* Matches the sidebar layout PageTopbar so the theme toggle sits in the same
   spot. It renders outside SidebarProvider, so it defines the topbar
   variables the provider wrapper would otherwise supply. */
export const FixedMainNav = () => {
  return (
    <header
      className={cn(
        "pointer-events-none fixed top-0 right-0 left-0 z-40 flex shrink-0 items-center justify-end bg-transparent",
        APP_VARIABLE_CLASS.sidebar(
          "ui-sidebar-layout-topbar-icon-button-size",
          "$sidebar-layout-topbar-default"
        ),
        APP_VARIABLE_CLASS.sidebar(
          "ui-sidebar-layout-topbar-padding",
          "$sidebar-layout-topbar-default"
        ),
        APP_VARIABLE_CLASSES.sidebar(
          [
            "ui-sidebar-layout-inset-gap",
            "ui-sidebar-layout-inset-border-width",
            "ui-sidebar-layout-inset-radius",
          ],
          "$sidebar-layout-inset-default"
        ),
        /* defines [--ui-sidebar-layout-topbar-button-radius] */
        SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_CLASS,
        /* defines [--ui-sidebar-layout-topbar-height] */
        SIDEBAR_LAYOUT_TOPBAR_HEIGHT_CLASS,
        "p-(--ui-sidebar-layout-topbar-padding)",
        "min-h-(--ui-sidebar-layout-topbar-height)"
      )}
    >
      <ThemeToggle
        className={cn(
          "pointer-events-auto",
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
          /* defines [--ui-button-radius] from topbar-button-radius */
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS
        )}
      />
    </header>
  );
};
