import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type SelectSpacingGroup = GroupContract<
  "ui-select-py" | "ui-select-px" | "ui-select-leading" | "ui-select-gap"
>;
type SelectIconGroup = GroupContract<
  "ui-select-icon-container-size" | "ui-select-icon-size"
>;
type SelectContentGroup = GroupContract<
  "ui-select-content-radius" | "ui-select-content-p"
>;
type SelectItemGroup = GroupContract<
  | "ui-select-item-py"
  | "ui-select-item-pl"
  | "ui-select-item-gap"
  | "ui-select-item-icon-size"
>;
type SelectItemIndicatorGroup = GroupContract<
  "ui-select-item-indicator-size" | "ui-select-item-indicator-inset"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract. */
export const SELECT_VARIABLE_GROUP_CLASSES = {
  /* default select size: --core-default-py + --core-default-leading = h-9 */
  "$select-default": {
    "ui-select-py": "[--ui-select-py:var(--core-default-py)]",
    "ui-select-px": "[--ui-select-px:var(--core-default-px)]",
    "ui-select-leading": "[--ui-select-leading:var(--core-default-leading)]",
    "ui-select-gap": "[--ui-select-gap:var(--core-default-gap)]",
  },
  /* small select size: py-1.25 + leading-5 = h-8 */
  "$select-small": {
    "ui-select-py": "[--ui-select-py:--spacing(1.25)]",
    "ui-select-px": "[--ui-select-px:--spacing(2)]",
    "ui-select-leading": "[--ui-select-leading:--spacing(5)]",
    "ui-select-gap": "[--ui-select-gap:--spacing(1.5)]",
  },
  /* dashboard inline operator: text-like, not a 30px field */
  "$select-inline": {
    "ui-select-py": "[--ui-select-py:1px]",
    "ui-select-px": "[--ui-select-px:--spacing(0.5)]",
    "ui-select-leading": "[--ui-select-leading:var(--core-default-leading)]",
    "ui-select-gap": "[--ui-select-gap:--spacing(0.5)]",
  },

  /* in select trigger, --ui-select-icon-container-size is used for calculating
     icon container radius and inset (i.e., padding relative to the trigger)
     (so changing --ui-select-icon-container-size always resolves the padding / icon
     container radius correctly) */
  "$select-icon-default": {
    /* prefix and chevron are not independently clickable, so the icon does not
       need extra space within the container:
       icon container default size (size-4) === icon default size (size-4) */
    "ui-select-icon-container-size":
      "[--ui-select-icon-container-size:--spacing(4)]",
    "ui-select-icon-size": "[--ui-select-icon-size:--spacing(4)]",
  },

  /* popup shell: radius and padding are only meaningful together so item
     radius can be derived as content-radius − content-p */
  "$select-content-default": {
    "ui-select-content-radius": "[--ui-select-content-radius:var(--radius-lg)]",
    "ui-select-content-p": "[--ui-select-content-p:--spacing(1)]",
  },

  /* item row chrome — not the concentric pair; changing these must not
     require retuning content-radius / content-p */
  "$select-item-default": {
    "ui-select-item-py": "[--ui-select-item-py:--spacing(1.5)]",
    "ui-select-item-pl": "[--ui-select-item-pl:--spacing(2)]",
    "ui-select-item-gap": "[--ui-select-item-gap:--spacing(2)]",
    "ui-select-item-icon-size": "[--ui-select-item-icon-size:--spacing(4)]",
  },
  "$select-item-indicator-default": {
    /* check sits in a size-3.5 box; the icon itself is size-4 (item icon) */
    "ui-select-item-indicator-size":
      "[--ui-select-item-indicator-size:--spacing(3.5)]",
    "ui-select-item-indicator-inset":
      "[--ui-select-item-indicator-inset:--spacing(2)]",
  },
} as const satisfies {
  "$select-default": SelectSpacingGroup;
  "$select-small": SelectSpacingGroup;
  "$select-inline": SelectSpacingGroup;
  "$select-icon-default": SelectIconGroup;
  "$select-content-default": SelectContentGroup;
  "$select-item-default": SelectItemGroup;
  "$select-item-indicator-default": SelectItemIndicatorGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class */
export const SELECT_VARIABLE_CLASSES = {
  /* core: same radius as other core elements */
  "ui-select-radius": {
    "$core-radius": "[--ui-select-radius:var(--radius-core)]",
    "$inline-radius": "[--ui-select-radius:var(--radius-sm)]",
  },
} as const satisfies TokenTableFor<"ui-select-radius">;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable. */

/* Leftover inset so container size + 2× padding matches leading + 2× --ui-select-py
   (so changing --ui-select-icon-container-size always resolves the padding correctly) */
export const SELECT_ICON_CONTAINER_INSET_CLASS =
  "[--ui-select-icon-container-inset:calc(var(--ui-select-py)+(var(--ui-select-leading)-var(--ui-select-icon-container-size))/2)]";

/* Concentric button radius: outer radius minus leftover inset
   (so changing --ui-select-icon-container-size always resolves the right icon container radius */
export const SELECT_ICON_CONTAINER_RADIUS_CLASS =
  "[--ui-select-icon-container-radius:max(0px,calc(var(--ui-select-radius)-var(--ui-select-icon-container-inset)))]";

/* Concentric item radius: outer content radius minus list padding
   (so changing --ui-select-content-p always resolves the item radius) */
export const SELECT_ITEM_RADIUS_CLASS =
  "[--ui-select-item-radius:max(0px,calc(var(--ui-select-content-radius)-var(--ui-select-content-p)))]";

/* Gutter for the absolute indicator: inset + max(container, icon) + item gap
   (so changing indicator inset / container / item icon size / gap always resolves pr) */
export const SELECT_ITEM_PR_CLASS =
  "[--ui-select-item-pr:calc(var(--ui-select-item-indicator-inset)+max(var(--ui-select-item-indicator-size),var(--ui-select-item-icon-size))+var(--ui-select-item-gap))]";
