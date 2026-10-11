import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type DropdownContentGroup = GroupContract<
  "ui-dropdown-content-radius" | "ui-dropdown-content-p"
>;
type DropdownItemGroup = GroupContract<
  | "ui-dropdown-item-py"
  | "ui-dropdown-item-pl"
  | "ui-dropdown-item-gap"
  | "ui-dropdown-item-icon-size"
>;
type DropdownItemIndicatorGroup = GroupContract<
  "ui-dropdown-item-indicator-size" | "ui-dropdown-item-indicator-inset"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract. */
export const DROPDOWN_VARIABLE_GROUP_CLASSES = {
  /* popup shell: radius and padding are only meaningful together so item
     radius can be derived as content-radius − content-p */
  "$dropdown-content-default": {
    "ui-dropdown-content-radius":
      "[--ui-dropdown-content-radius:var(--radius-lg)]",
    "ui-dropdown-content-p": "[--ui-dropdown-content-p:--spacing(1)]",
  },

  /* item row chrome — not the concentric pair; changing these must not
     require retuning content-radius / content-p */
  "$dropdown-item-default": {
    "ui-dropdown-item-py": "[--ui-dropdown-item-py:--spacing(1.5)]",
    "ui-dropdown-item-pl": "[--ui-dropdown-item-pl:--spacing(2)]",
    "ui-dropdown-item-gap": "[--ui-dropdown-item-gap:--spacing(2)]",
    "ui-dropdown-item-icon-size": "[--ui-dropdown-item-icon-size:--spacing(4)]",
  },
  "$dropdown-item-indicator-default": {
    /* check sits in a size-3.5 box; the icon itself is size-4 (item icon) */
    "ui-dropdown-item-indicator-size":
      "[--ui-dropdown-item-indicator-size:--spacing(3.5)]",
    "ui-dropdown-item-indicator-inset":
      "[--ui-dropdown-item-indicator-inset:--spacing(2)]",
  },
} as const satisfies {
  "$dropdown-content-default": DropdownContentGroup;
  "$dropdown-item-default": DropdownItemGroup;
  "$dropdown-item-indicator-default": DropdownItemIndicatorGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class.
   Popup radius is paired with padding, so it is not a standalone token. */
export const DROPDOWN_VARIABLE_CLASSES =
  {} as const satisfies TokenTableFor<never>;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable. */

/* Concentric item radius: outer content radius minus popup padding
   (so changing --ui-dropdown-content-p always resolves the item radius) */
export const DROPDOWN_ITEM_RADIUS_CLASS =
  "[--ui-dropdown-item-radius:max(0px,calc(var(--ui-dropdown-content-radius)-var(--ui-dropdown-content-p)))]";

/* Gutter for the absolute left indicator (and inset): inset + max(container, icon) + item gap
   (so changing indicator inset / container / item icon size / gap always resolves pl) */
export const DROPDOWN_ITEM_INDICATOR_PL_CLASS =
  "[--ui-dropdown-item-indicator-pl:calc(var(--ui-dropdown-item-indicator-inset)+max(var(--ui-dropdown-item-indicator-size),var(--ui-dropdown-item-icon-size))+var(--ui-dropdown-item-gap))]";
