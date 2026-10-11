import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type SidebarLayoutInsetGroup = GroupContract<
  | "ui-sidebar-layout-inset-gap"
  | "ui-sidebar-layout-inset-border-width"
  | "ui-sidebar-layout-inset-radius"
>;
type SidebarPaddingGroup = GroupContract<"ui-sidebar-px" | "ui-sidebar-row-px">;
type SidebarPrefixGroup = GroupContract<
  | "ui-sidebar-prefix-container-size"
  | "ui-sidebar-prefix-gap"
  | "ui-sidebar-header-prefix-icon-size"
  | "ui-sidebar-menu-prefix-icon-size"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract. */
export const SIDEBAR_VARIABLE_GROUP_CLASSES = {
  /* inset and floating cards share one gap, border, and radius; topbar-mt is
     gap + border-width so the first topbar band clears the card edge;
     topbar-button-radius is radius − border-width − topbar-padding so topbar
     buttons stay concentric with the card */
  "$sidebar-layout-inset-default": {
    "ui-sidebar-layout-inset-gap":
      "[--ui-sidebar-layout-inset-gap:--spacing(2)]",
    "ui-sidebar-layout-inset-border-width":
      "[--ui-sidebar-layout-inset-border-width:1px]",
    "ui-sidebar-layout-inset-radius":
      "[--ui-sidebar-layout-inset-radius:var(--radius-4xl)]",
  },

  /* rail padding and the inner row share one pair so header text-start and
     nav text-start resolve from the same sum */
  "$sidebar-padding-default": {
    "ui-sidebar-px": "[--ui-sidebar-px:--spacing(2)]",
    "ui-sidebar-row-px": "[--ui-sidebar-row-px:--spacing(2)]",
  },

  /* header mark and nav icon share one container; glyphs may differ:
     header icon (size-3) < container (size-5); menu icon (size-4) < container */
  "$sidebar-prefix-default": {
    "ui-sidebar-prefix-container-size":
      "[--ui-sidebar-prefix-container-size:--spacing(5)]",
    "ui-sidebar-prefix-gap": "[--ui-sidebar-prefix-gap:--spacing(2)]",
    "ui-sidebar-header-prefix-icon-size":
      "[--ui-sidebar-header-prefix-icon-size:--spacing(3)]",
    "ui-sidebar-menu-prefix-icon-size":
      "[--ui-sidebar-menu-prefix-icon-size:--spacing(4)]",
  },
} as const satisfies {
  "$sidebar-layout-inset-default": SidebarLayoutInsetGroup;
  "$sidebar-padding-default": SidebarPaddingGroup;
  "$sidebar-prefix-default": SidebarPrefixGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class. */
export const SIDEBAR_VARIABLE_CLASSES = {
  /* Header row and topbar buttons share one icon-button size — one name so the
     two bands cannot drift. Matches icon-xs (--spacing(7)). The mapping class
     reassigns --ui-button-size after the Button size group so the shared
     topbar size wins over the icon-xs assignment. */
  "ui-sidebar-layout-topbar-icon-button-size": {
    "$sidebar-layout-topbar-default":
      "[--ui-sidebar-layout-topbar-icon-button-size:--spacing(7)]",
  },
  /* Even padding around the topbar row. Band height is leftover
     (icon-button-size + 2×topbar-padding); button radius is leftover
     (inset-radius − inset-border-width − topbar-padding). */
  "ui-sidebar-layout-topbar-padding": {
    "$sidebar-layout-topbar-default":
      "[--ui-sidebar-layout-topbar-padding:--spacing(2.5)]",
  },
} as const satisfies TokenTableFor<
  | "ui-sidebar-layout-topbar-icon-button-size"
  | "ui-sidebar-layout-topbar-padding"
>;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable.
   Painted classes that are not leftover formulas also live here. */

/* Topbar band top offset: inset gap + inset border so header / topbar clear
   the inset or floating card edge (so changing either always resolves mt). */
export const SIDEBAR_LAYOUT_TOPBAR_MT_CLASS =
  "[--ui-sidebar-layout-topbar-mt:calc(var(--ui-sidebar-layout-inset-gap)+var(--ui-sidebar-layout-inset-border-width))]";

/* Concentric topbar button radius: inner card radius minus topbar padding
   (so changing inset radius / border / topbar-padding always resolves the button). */
export const SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_CLASS =
  "[--ui-sidebar-layout-topbar-button-radius:max(0px,calc(var(--ui-sidebar-layout-inset-radius)-var(--ui-sidebar-layout-inset-border-width)-var(--ui-sidebar-layout-topbar-padding)))]";

/* Topbar divider: inset box-shadow paints a 1px bottom rule without occupying
   box-model space, so padding stays even topbar-padding and band height is
   literally icon-button-size + 2×topbar-padding. Not a leftover formula — a
   painted class. */
export const SIDEBAR_LAYOUT_TOPBAR_DIVIDER_CLASS =
  "shadow-[inset_0_-1px_0_0_var(--color-subtle)]";

/* Topbar band height: icon-button-size + 2×topbar-padding. Applied as min-h so
   padding resolves the height and the two bands still cannot collapse. */
export const SIDEBAR_LAYOUT_TOPBAR_HEIGHT_CLASS =
  "[--ui-sidebar-layout-topbar-height:calc(var(--ui-sidebar-layout-topbar-icon-button-size)+2*var(--ui-sidebar-layout-topbar-padding))]";

/* Reassigns --ui-button-radius on the topbar Button after the size group,
   which otherwise pins the size's core radius on the same element. Applied
   via className so it wins in cn() after buttonVariants. */
export const SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS =
  "[--ui-button-radius:var(--ui-sidebar-layout-topbar-button-radius)]";

/* Reassigns --ui-button-size on the topbar Button after the size group.
   Radius mapping stays a radius assignment only. */
export const SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS =
  "[--ui-button-size:var(--ui-sidebar-layout-topbar-icon-button-size)]";

/* Integer line box: title leading matches the prefix container so items-center
   has nothing left to split (so no fractional stack i.e. any text (or
   flex-centered sibling of text) whose used height or `items-center` offset
   is not a whole CSS pixel). */
export const SIDEBAR_ROW_LEADING_CLASS =
  "[--ui-sidebar-row-leading:var(--ui-sidebar-prefix-container-size)]";

/* Text start of header and nav rows: rail px + row px + prefix container + gap
   (so changing any of those always resolves the shared text line). */
export const SIDEBAR_TEXT_START_CLASS =
  "[--ui-sidebar-text-start:calc(var(--ui-sidebar-px)+var(--ui-sidebar-row-px)+var(--ui-sidebar-prefix-container-size)+var(--ui-sidebar-prefix-gap))]";
