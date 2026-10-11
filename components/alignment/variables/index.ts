import { BADGE_VARIABLE_CLASSES, BADGE_VARIABLE_GROUP_CLASSES } from "./_badge";
import {
  BUTTON_VARIABLE_CLASSES,
  BUTTON_VARIABLE_GROUP_CLASSES,
} from "./_button";
import { DEMO_GRID_VARIABLE_GROUP_CLASSES } from "./_demo-grid";
import {
  DROPDOWN_VARIABLE_CLASSES,
  DROPDOWN_VARIABLE_GROUP_CLASSES,
} from "./_dropdown";
import { INPUT_VARIABLE_CLASSES, INPUT_VARIABLE_GROUP_CLASSES } from "./_input";
import {
  SELECT_VARIABLE_CLASSES,
  SELECT_VARIABLE_GROUP_CLASSES,
} from "./_select";
import {
  SIDEBAR_VARIABLE_CLASSES,
  SIDEBAR_VARIABLE_GROUP_CLASSES,
} from "./_sidebar";
import {
  type AssertTrue,
  type GroupmatesOf,
  type GroupVariableOf,
  type GroupWithAllOrError,
  type TokenOf,
} from "./types";

/* variable -> token -> class */
export const VARIABLE_CLASSES = {
  ...INPUT_VARIABLE_CLASSES,
  ...SELECT_VARIABLE_CLASSES,
  ...DROPDOWN_VARIABLE_CLASSES,
  ...BUTTON_VARIABLE_CLASSES,
  ...BADGE_VARIABLE_CLASSES,
  ...SIDEBAR_VARIABLE_CLASSES,
} as const;

/* group -> variable -> class */
export const VARIABLE_GROUP_CLASSES = {
  ...DEMO_GRID_VARIABLE_GROUP_CLASSES,
  ...INPUT_VARIABLE_GROUP_CLASSES,
  ...SELECT_VARIABLE_GROUP_CLASSES,
  ...DROPDOWN_VARIABLE_GROUP_CLASSES,
  ...BUTTON_VARIABLE_GROUP_CLASSES,
  ...BADGE_VARIABLE_GROUP_CLASSES,
  ...SIDEBAR_VARIABLE_GROUP_CLASSES,
} as const;

type VariableClasses = typeof VARIABLE_CLASSES;
type VariableGroupClasses = typeof VARIABLE_GROUP_CLASSES;

/* Register a new family here and in the merged spreads above. */
type VariableTablesByFamily = {
  demoGrid: {
    classes: Record<never, never>;
    groups: typeof DEMO_GRID_VARIABLE_GROUP_CLASSES;
  };
  input: {
    classes: typeof INPUT_VARIABLE_CLASSES;
    groups: typeof INPUT_VARIABLE_GROUP_CLASSES;
  };
  select: {
    classes: typeof SELECT_VARIABLE_CLASSES;
    groups: typeof SELECT_VARIABLE_GROUP_CLASSES;
  };
  dropdown: {
    classes: typeof DROPDOWN_VARIABLE_CLASSES;
    groups: typeof DROPDOWN_VARIABLE_GROUP_CLASSES;
  };
  button: {
    classes: typeof BUTTON_VARIABLE_CLASSES;
    groups: typeof BUTTON_VARIABLE_GROUP_CLASSES;
  };
  badge: {
    classes: typeof BADGE_VARIABLE_CLASSES;
    groups: typeof BADGE_VARIABLE_GROUP_CLASSES;
  };
  sidebar: {
    classes: typeof SIDEBAR_VARIABLE_CLASSES;
    groups: typeof SIDEBAR_VARIABLE_GROUP_CLASSES;
  };
};

export type VariableFamily = keyof VariableTablesByFamily;

type TokenTableForFamily<Family extends VariableFamily> =
  VariableTablesByFamily[Family]["classes"];

type GroupTableForFamily<Family extends VariableFamily> =
  VariableTablesByFamily[Family]["groups"];

export type VariableName = keyof VariableClasses;
export type VariableGroupName = keyof VariableGroupClasses;
export type GroupVariableName = GroupVariableOf<VariableGroupClasses>;

type TokenVariableOfFamily<Family extends VariableFamily> =
  keyof TokenTableForFamily<Family> & VariableName;

type GroupVariableOfFamily<Family extends VariableFamily> = GroupVariableOf<
  GroupTableForFamily<Family>
> &
  GroupVariableName;

type ScopedGetVariableClass<Family extends VariableFamily> = <
  Variable extends TokenVariableOfFamily<Family>,
>(
  variable: Variable,
  token: TokenOf<TokenTableForFamily<Family>, Variable>
) => string;

type ScopedGetVariableClasses<Family extends VariableFamily> = <
  First extends GroupVariableOfFamily<Family>,
  Rest extends readonly GroupmatesOf<GroupTableForFamily<Family>, First>[],
>(
  variables: readonly [First, ...Rest],
  group: GroupWithAllOrError<GroupTableForFamily<Family>, First | Rest[number]>
) => string[];

/* A variable is owned by exactly one live table. Without this, a group member
   could also be set through a standalone token, and tailwind-merge would
   silently resolve the duplicate assignment to whichever class came last.
   Exported only so the assertion counts as used. */
export type VariableTablesAreDisjoint = AssertTrue<
  Extract<VariableName, GroupVariableName> extends never ? true : false
>;

/* Reading a const table with a generic key needs a widened view; the wrappers
   below have already proven the variable/token or variable/group pair exists. */
const variableClassLookup: Record<
  string,
  Record<string, string>
> = VARIABLE_CLASSES;
const variableGroupClassLookup: Record<
  string,
  Record<string, string>
> = VARIABLE_GROUP_CLASSES;

function getVariableClassToken<Variable extends VariableName>(
  variable: Variable,
  token: TokenOf<VariableClasses, Variable>
): string {
  return variableClassLookup[variable][token];
}

function getVariableClassGroup<
  First extends GroupVariableName,
  Rest extends readonly GroupmatesOf<VariableGroupClasses, First>[],
>(
  variables: readonly [First, ...Rest],
  group: GroupWithAllOrError<VariableGroupClasses, First | Rest[number]>
): string[] {
  const groupClasses = variableGroupClassLookup[group];
  return variables.map((variable) => groupClasses[variable]);
}

/**
 * Look up the class that assigns a standalone CSS variable to one of its tokens.
 * Scope via `.input` / `.select` / `.dropdown` / `.button` / `.badge` /
 * `.sidebar` so completions stay in that family.
 *
 * @example
 * APP_VARIABLE_CLASS.input("ui-input-radius", "$core-radius")
 */
export const APP_VARIABLE_CLASS: {
  [Family in VariableFamily]: ScopedGetVariableClass<Family>;
} = Object.assign(getVariableClassToken, {
  demoGrid: getVariableClassToken as ScopedGetVariableClass<"demoGrid">,
  input: getVariableClassToken as ScopedGetVariableClass<"input">,
  select: getVariableClassToken as ScopedGetVariableClass<"select">,
  dropdown: getVariableClassToken as ScopedGetVariableClass<"dropdown">,
  button: getVariableClassToken as ScopedGetVariableClass<"button">,
  badge: getVariableClassToken as ScopedGetVariableClass<"badge">,
  sidebar: getVariableClassToken as ScopedGetVariableClass<"sidebar">,
});

/**
 * Look up the classes that assign every listed CSS variable from one group.
 * The list may be a subset of the group. The first name pins the groupmates;
 * later names must share a group with it. Scope via `.input` / `.select` /
 * `.dropdown` / `.button` / `.badge` / `.sidebar` so first-name completions
 * stay in that family.
 *
 * @example
 * APP_VARIABLE_CLASSES.input(["ui-input-py", "ui-input-leading"], "$input-default")
 */
export const APP_VARIABLE_CLASSES: {
  [Family in VariableFamily]: ScopedGetVariableClasses<Family>;
} = Object.assign(getVariableClassGroup, {
  demoGrid: getVariableClassGroup as ScopedGetVariableClasses<"demoGrid">,
  input: getVariableClassGroup as ScopedGetVariableClasses<"input">,
  select: getVariableClassGroup as ScopedGetVariableClasses<"select">,
  dropdown: getVariableClassGroup as ScopedGetVariableClasses<"dropdown">,
  button: getVariableClassGroup as ScopedGetVariableClasses<"button">,
  badge: getVariableClassGroup as ScopedGetVariableClasses<"badge">,
  sidebar: getVariableClassGroup as ScopedGetVariableClasses<"sidebar">,
});

/* Three places an alignment assignment can live — keep them apart.

   VARIABLE_GROUP_CLASSES (group -> variable -> class)
   Authored knobs that are only meaningful as a set. A group documents a
   relationship between *different* values that must be chosen together
   (py + leading, content-radius + content-p, inset-gap + inset-border-width
   + inset-radius). GroupContract forces every sibling size/variant to
   declare the full set. APP_VARIABLE_CLASSES may still take a subset, so
   membership does not force every caller to apply every member.

   VARIABLE_CLASSES (variable -> token -> class)
   Authored knobs whose alternatives stand alone. One name, several tokens
   (ui-input-radius → $core-radius). A single-member *group* would be noise:
   there is no sibling that could omit the variable. topbar-padding lives here
   because it is the authored inset — not leftover from other knobs —
   and a later $sidebar-layout-topbar-compact can swap it without a group.
   topbar-icon-button-size lives here because header and topbar share one
   content row — one name so they cannot drift — not because it is leftover
   from other knobs.

   Constants (in the family file, not in either table)
   Derived leftover class literals: a formula over catalogued variables,
   not a knob. Grouped input defaults belong to InputGroup; addon inset and
   radius formulas resolve locally on the addon. Named inherit mappings let
   a nested Input read the group without resetting those values.
   --ui-select-item-radius = content-radius − content-p;
   --ui-button-icon-container-inset = py + (leading − icon-container-size) / 2;
   --ui-button-icon-container-radius = radius − inset;
   --ui-sidebar-layout-topbar-mt = inset-gap + inset-border-width;
   --ui-sidebar-layout-topbar-button-radius = inset-radius −
     inset-border-width − topbar-padding;
   --ui-sidebar-layout-topbar-height = topbar-icon-button-size + 2×topbar-padding;
   --ui-sidebar-text-start = px + row-px + prefix-container + prefix-gap.
   CSS var() is late-bound, so the calc would still resolve if the string
   lived in a table. The tables are the wrong home because:

   - A group implies alternatives. A later $inset-compact would be forced to
     declare topbar-mt too, and GroupContract only checks that some assignment
     exists — not that it is the formula. A hardcoded 9px would type-check.
     One component literal is the leftover guarantee: changing either input
     always re-resolves the derived length.
   - APP_VARIABLE_CLASSES allows subsets. Putting topbar-mt in the group would
     make gap + border without topbar-mt a valid call, and mt would go unset.
     The owner (layout or component) applies the leftover const; callers map
     or inherit it rather than treating the const as unoverridable.
   - A standalone token implies you can pick topbar-button-radius independently
     of the inset group and topbar-padding, which is the opposite of leftover
     concentric radius.
   - Derived vars can span groups (topbar-button-radius reads the inset group
     *and* topbar-padding; text-start reads padding *and* prefix). Putting the
     formula in one group is a lie; putting it in both duplicates it.

   Catalog assignments; keep formulas as one source literal Tailwind can see.
   VariableTablesAreDisjoint already forbids a name from living in both tables;
   derived constants stay out of both. A shape override of a group member
   (BUTTON_CIRCLE_RADIUS_CLASS on --ui-button-radius) is the same rule: a
   one-token table would dual-home the variable. */
