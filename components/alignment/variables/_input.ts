import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type InputSpacingGroup = GroupContract<
  "ui-input-py" | "ui-input-px" | "ui-input-leading" | "ui-input-gap"
>;
type InputIconGroup = GroupContract<
  "ui-input-icon-container-size" | "ui-input-icon-size"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract. */
export const INPUT_VARIABLE_GROUP_CLASSES = {
  /* default input size: --core-default-py + --core-default-leading = h-9 */
  "$input-default": {
    "ui-input-py": "[--ui-input-py:var(--core-default-py)]",
    "ui-input-px": "[--ui-input-px:var(--core-default-px)]",
    "ui-input-leading": "[--ui-input-leading:var(--core-default-leading)]",
    "ui-input-gap": "[--ui-input-gap:var(--core-default-gap)]",
  },
  /* dashboard compact filter field: py-1 + default leading, 8px horizontal */
  "$input-compact": {
    "ui-input-py": "[--ui-input-py:--spacing(1)]",
    "ui-input-px": "[--ui-input-px:--spacing(2)]",
    "ui-input-leading": "[--ui-input-leading:var(--core-default-leading)]",
    "ui-input-gap": "[--ui-input-gap:var(--core-default-gap)]",
  },

  /* in input group, --ui-input-icon-container-size is used for calculating 
     icon container radius and inset (i.e., padding relative to input)
     (so changing --ui-input-icon-container-size always resolves the padding / icon
     container radius correctly) */
  "$input-icon-default": {
    /* in input group, icon is not clickable by default, so icon does not need
       extra space within container:
       icon container default size (size-4) === icon default size (size-4) */
    "ui-input-icon-container-size":
      "[--ui-input-icon-container-size:--spacing(4)]",
    "ui-input-icon-size": "[--ui-input-icon-size:--spacing(4)]",
  },
  "$input-icon-button": {
    /* in input group, clickable icon button has larger size than the icon so
       that the icon has space within the icon button: 
       icon container button size (size-6) > icon default size (size-4) */
    "ui-input-icon-container-size":
      "[--ui-input-icon-container-size:--spacing(6)]",
    "ui-input-icon-size": "[--ui-input-icon-size:--spacing(4)]",
  },
  "$input-icon-button-small": {
    /* dashboard search clear action: 20px box, same 16px icon */
    "ui-input-icon-container-size":
      "[--ui-input-icon-container-size:--spacing(5)]",
    "ui-input-icon-size": "[--ui-input-icon-size:--spacing(4)]",
  },
} as const satisfies {
  "$input-default": InputSpacingGroup;
  "$input-compact": InputSpacingGroup;
  "$input-icon-default": InputIconGroup;
  "$input-icon-button": InputIconGroup;
  "$input-icon-button-small": InputIconGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class */
export const INPUT_VARIABLE_CLASSES = {
  /* core: same radius as other core elements */
  "ui-input-radius": {
    "$core-radius": "[--ui-input-radius:var(--radius-core)]",
    "$compact-radius": "[--ui-input-radius:var(--radius-sm)]",
  },
} as const satisfies TokenTableFor<"ui-input-radius">;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable. */

/* Leftover inset so container size + 2× padding matches leading + 2× --ui-input-py
   (so changing --ui-input-icon-container-size always resolves the padding correctly) */
export const INPUT_ICON_CONTAINER_INSET_CLASS =
  "[--ui-input-icon-container-inset:calc(var(--ui-input-py)+(var(--ui-input-leading)-var(--ui-input-icon-container-size))/2)]";

/* Concentric button radius: outer radius minus leftover inset
   (so changing --ui-input-icon-container-size always resolves the right icon container radius */
export const INPUT_ICON_CONTAINER_RADIUS_CLASS =
  "[--ui-input-icon-container-radius:max(0px,calc(var(--ui-input-radius)-var(--ui-input-icon-container-inset)))]";

/* Grouped Input inherits these from InputGroup so the nested field does not
   reset to independent defaults. Addon inset/radius formulas still resolve
   locally on the addon. */
export const INPUT_GROUP_INHERIT_PY_CLASS = "[--ui-input-py:inherit]";
export const INPUT_GROUP_INHERIT_PX_CLASS = "[--ui-input-px:inherit]";
export const INPUT_GROUP_INHERIT_LEADING_CLASS = "[--ui-input-leading:inherit]";
export const INPUT_GROUP_INHERIT_GAP_CLASS = "[--ui-input-gap:inherit]";
export const INPUT_GROUP_INHERIT_RADIUS_CLASS = "[--ui-input-radius:inherit]";
