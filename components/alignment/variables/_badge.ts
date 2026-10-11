import { type GroupContract, type TokenTableFor } from "./types";

/* Arbitrary-property classes that pin a CSS variable to a spacing step.
   Each full string must stay a literal so Tailwind's scanner emits the CSS. */

/* Contracts a group of each family must fulfil, so a new size or icon variant
   cannot define a subset of what its siblings define. Each class literal must
   also assign the variable named by its key. */
type BadgeSpacingGroup = GroupContract<
  "ui-badge-py" | "ui-badge-px" | "ui-badge-leading"
>;
type BadgeDotGroup = GroupContract<"ui-badge-dot-size" | "ui-badge-dot-gap">;
type BadgeIconGroup = GroupContract<
  "ui-badge-icon-container-size" | "ui-badge-icon-size" | "ui-badge-icon-gap"
>;
type BadgeCloseGroup = GroupContract<
  | "ui-badge-close-container-size"
  | "ui-badge-close-icon-size"
  | "ui-badge-close-gap"
>;

/* ============================================================================
   Variable Group Classes
   ============================================================================ */

/* Variables that are only meaningful together: group -> variable -> class.
   Every group is named in the satisfies clause below, which is what forces a
   new group to declare — and fully implement — its family contract.

   Dot, icon, and close can co-occur on one badge (dot + close, icon + close),
   so their variable names stay disjoint — unlike labeled-button prefix/suffix,
   which share one icon-container-size. */
export const BADGE_VARIABLE_GROUP_CLASSES = {
  /* default badge size: py-0.5 + leading-4 = h-5.5 (22px with 1px border) */
  "$badge-default": {
    "ui-badge-py": "[--ui-badge-py:--spacing(0.5)]",
    "ui-badge-px": "[--ui-badge-px:--spacing(2)]",
    "ui-badge-leading": "[--ui-badge-leading:--spacing(4)]",
  },

  /* the dot is the mark, not a chip: container size === the 6px indicator */
  "$badge-dot-default": {
    "ui-badge-dot-size": "[--ui-badge-dot-size:--spacing(1.5)]",
    "ui-badge-dot-gap": "[--ui-badge-dot-gap:--spacing(1.25)]",
  },

  /* prefix/suffix icons are not independently clickable, so the icon does not
     need extra space within the container:
     icon container default size (size-3) === icon default size (size-3) */
  "$badge-icon-default": {
    "ui-badge-icon-container-size":
      "[--ui-badge-icon-container-size:--spacing(3)]",
    "ui-badge-icon-size": "[--ui-badge-icon-size:--spacing(3)]",
    "ui-badge-icon-gap": "[--ui-badge-icon-gap:--spacing(1.25)]",
  },

  /* close is independently clickable, so the chip is larger than the icon:
     close container (size-3.5) > close icon (size-2.5) */
  "$badge-close-default": {
    "ui-badge-close-container-size":
      "[--ui-badge-close-container-size:--spacing(3.5)]",
    "ui-badge-close-icon-size": "[--ui-badge-close-icon-size:--spacing(2.5)]",
    "ui-badge-close-gap": "[--ui-badge-close-gap:--spacing(0.5)]",
  },
} as const satisfies {
  "$badge-default": BadgeSpacingGroup;
  "$badge-dot-default": BadgeDotGroup;
  "$badge-icon-default": BadgeIconGroup;
  "$badge-close-default": BadgeCloseGroup;
};

/* ============================================================================
   Variable Classes
   ============================================================================ */

/* Variables whose alternatives stand alone: variable -> token -> class */
export const BADGE_VARIABLE_CLASSES = {
  /* sm: square badge (rounded-sm); full: pill / circle shape */
  "ui-badge-radius": {
    "$sm-radius": "[--ui-badge-radius:var(--radius-sm)]",
    "$full-radius": "[--ui-badge-radius:calc(infinity*1px)]",
  },
} as const satisfies TokenTableFor<"ui-badge-radius">;

/* ============================================================================
   Constants
   ============================================================================ */

/* Derived leftovers: a formula over catalogued variables, not a knob.
   Centralized outside the selectable token tables so the formula lives in
   one place. Callers can still omit the constant or override the variable. */

/* Leftover inset so container size + 2× padding matches leading + 2× --ui-badge-py
   (so changing a slot's container size always resolves that side's padding).
   Prefix and suffix are separate because mixed slots (dot + close) differ. */
export const BADGE_PREFIX_CONTAINER_INSET_CLASS =
  "[--ui-badge-prefix-inset:calc(var(--ui-badge-py)+(var(--ui-badge-leading)-var(--ui-badge-prefix-container-size))/2)]";
export const BADGE_SUFFIX_CONTAINER_INSET_CLASS =
  "[--ui-badge-suffix-inset:calc(var(--ui-badge-py)+(var(--ui-badge-leading)-var(--ui-badge-suffix-container-size))/2)]";

/* Concentric badge radius: outer radius minus leftover inset
   (so changing a slot's container size always resolves that side's chip radius) */
export const BADGE_PREFIX_CONTAINER_RADIUS_CLASS =
  "[--ui-badge-prefix-radius:max(0px,calc(var(--ui-badge-radius)-var(--ui-badge-prefix-inset)))]";
export const BADGE_SUFFIX_CONTAINER_RADIUS_CLASS =
  "[--ui-badge-suffix-radius:max(0px,calc(var(--ui-badge-radius)-var(--ui-badge-suffix-inset)))]";

export const BADGE_PREFIX_CONTAINER_FROM_DOT_CLASS =
  "[--ui-badge-prefix-container-size:var(--ui-badge-dot-size)]";
export const BADGE_PREFIX_CONTAINER_FROM_ICON_CLASS =
  "[--ui-badge-prefix-container-size:var(--ui-badge-icon-container-size)]";
export const BADGE_SUFFIX_CONTAINER_FROM_ICON_CLASS =
  "[--ui-badge-suffix-container-size:var(--ui-badge-icon-container-size)]";
export const BADGE_SUFFIX_CONTAINER_FROM_CLOSE_CLASS =
  "[--ui-badge-suffix-container-size:var(--ui-badge-close-container-size)]";
