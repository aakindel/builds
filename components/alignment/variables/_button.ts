import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type ButtonSpacingGroup = GroupContract<
  | "ui-button-py"
  | "ui-button-px"
  | "ui-button-leading"
  | "ui-button-gap"
  | "ui-button-radius"
>;
type ButtonIconGroup = GroupContract<
  "ui-button-icon-container-size" | "ui-button-icon-size"
>;
type ButtonIconButtonGroup = GroupContract<
  "ui-button-size" | "ui-button-icon-size" | "ui-button-radius"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract. */
export const BUTTON_VARIABLE_GROUP_CLASSES = {
  /* default labeled size: --core-default-py + --core-default-leading = h-9 */
  "$button-default": {
    "ui-button-py": "[--ui-button-py:var(--core-default-py)]",
    "ui-button-px": "[--ui-button-px:var(--core-default-px)]",
    "ui-button-leading": "[--ui-button-leading:var(--core-default-leading)]",
    "ui-button-gap": "[--ui-button-gap:var(--core-default-gap)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core)]",
  },
  /* small labeled size: py-1.25 + leading-5 = h-8 */
  "$button-small": {
    "ui-button-py": "[--ui-button-py:--spacing(1.25)]",
    "ui-button-px": "[--ui-button-px:--spacing(2)]",
    "ui-button-leading": "[--ui-button-leading:--spacing(5)]",
    "ui-button-gap": "[--ui-button-gap:--spacing(1.5)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core)]",
  },
  /* dashboard toolbar chip: py-1 + leading-5 + 1px borders = 30px */
  "$button-chip": {
    "ui-button-py": "[--ui-button-py:--spacing(1)]",
    "ui-button-px": "[--ui-button-px:--spacing(2)]",
    "ui-button-leading": "[--ui-button-leading:--spacing(5)]",
    "ui-button-gap": "[--ui-button-gap:var(--core-default-gap)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core)]",
  },
  /* dashboard toolbar quiet action: same 30px box, tighter gap */
  "$button-quiet": {
    "ui-button-py": "[--ui-button-py:--spacing(1)]",
    "ui-button-px": "[--ui-button-px:--spacing(2)]",
    "ui-button-leading": "[--ui-button-leading:--spacing(5)]",
    "ui-button-gap": "[--ui-button-gap:--spacing(1)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core)]",
  },

  /* in labeled button, --ui-button-icon-container-size is used for calculating
     icon container radius and inset (i.e., padding relative to the button)
     (so changing --ui-button-icon-container-size always resolves the padding / icon
     container radius correctly) */
  "$button-icon-default": {
    /* prefix and suffix are not independently clickable, so the icon does not
       need extra space within the container:
       icon container default size (size-4) === icon default size (size-4) */
    "ui-button-icon-container-size":
      "[--ui-button-icon-container-size:--spacing(4)]",
    "ui-button-icon-size": "[--ui-button-icon-size:--spacing(4)]",
  },
  "$button-icon-small": {
    /* labeled sm icons are smaller than default (size-3.5) */
    "ui-button-icon-container-size":
      "[--ui-button-icon-container-size:--spacing(3.5)]",
    "ui-button-icon-size": "[--ui-button-icon-size:--spacing(3.5)]",
  },

  /* icon-only buttons are a filled square (p-0), not py + leading. labeled sm
     uses size-3.5 icons; icon-sm uses size-4 in the same 32px box — do not
     share an icon group between those two. Each icon size assigns
     --ui-button-radius (icon-xs → --radius-core-xs); shape=circle overrides
     it via BUTTON_CIRCLE_RADIUS_CLASS. */
  "$button-icon-button-default": {
    "ui-button-size": "[--ui-button-size:--spacing(9)]",
    "ui-button-icon-size": "[--ui-button-icon-size:--spacing(4)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core)]",
  },
  "$button-icon-button-small": {
    "ui-button-size": "[--ui-button-size:--spacing(8)]",
    "ui-button-icon-size": "[--ui-button-icon-size:--spacing(4)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core-sm)]",
  },
  "$button-icon-button-xsmall": {
    "ui-button-size": "[--ui-button-size:--spacing(7)]",
    "ui-button-icon-size": "[--ui-button-icon-size:--spacing(4)]",
    "ui-button-radius": "[--ui-button-radius:var(--radius-core-xs)]",
  },
} as const satisfies {
  "$button-default": ButtonSpacingGroup;
  "$button-small": ButtonSpacingGroup;
  "$button-chip": ButtonSpacingGroup;
  "$button-quiet": ButtonSpacingGroup;
  "$button-icon-default": ButtonIconGroup;
  "$button-icon-small": ButtonIconGroup;
  "$button-icon-button-default": ButtonIconButtonGroup;
  "$button-icon-button-small": ButtonIconButtonGroup;
  "$button-icon-button-xsmall": ButtonIconButtonGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class.
   --ui-button-radius lives on the size groups, so it is not a standalone token. */
export const BUTTON_VARIABLE_CLASSES =
  {} as const satisfies TokenTableFor<never>;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable. */

/* Leftover inset so container size + 2× padding matches leading + 2× --ui-button-py
   (so changing --ui-button-icon-container-size always resolves the padding correctly) */
export const BUTTON_ICON_CONTAINER_INSET_CLASS =
  "[--ui-button-icon-container-inset:calc(var(--ui-button-py)+(var(--ui-button-leading)-var(--ui-button-icon-container-size))/2)]";

/* Concentric button radius: outer radius minus leftover inset
   (so changing --ui-button-icon-container-size always resolves the right icon container radius */
export const BUTTON_ICON_CONTAINER_RADIUS_CLASS =
  "[--ui-button-icon-container-radius:max(0px,calc(var(--ui-button-radius)-var(--ui-button-icon-container-inset)))]";

/* Shape override of a group member, not a leftover formula and not a sibling
   token. A one-token table would dual-home --ui-button-radius and fail
   VariableTablesAreDisjoint. Applied after the size group so it wins in cn(). */
export const BUTTON_CIRCLE_RADIUS_CLASS =
  "[--ui-button-radius:calc(infinity*1px)]";
