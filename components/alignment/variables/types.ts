/* Helpers for the merged registry in ./index.ts, so the two table shapes
   (token and group) are described the same way. */

/* A class literal must assign the CSS variable named by its key, e.g.
   "ui-input-py" → "[--ui-input-py:--spacing(1.75)]". */
export type VariableAssignment<Variable extends string> =
  `[--${Variable}:${string}]`;

/* group -> variable -> class: each member's value must assign that variable */
export type GroupContract<Variables extends string> = {
  [Variable in Variables]: VariableAssignment<Variable>;
};

/* variable -> token -> class: each token's value must assign that variable */
export type TokenTableFor<Variables extends string> = {
  [Variable in Variables]: Record<string, VariableAssignment<Variable>>;
};

/* variable -> token -> class: a variable that carries alternative values alone */
export type VariableClassTable = Record<string, Record<string, string>>;

/* group -> variable -> class: variables that are only meaningful as a set */
export type VariableGroupClassTable = Record<string, Record<string, string>>;

export type TokenOf<
  Table extends VariableClassTable,
  Variable extends keyof Table,
> = keyof Table[Variable] & string;

export type GroupVariableOf<Table extends VariableGroupClassTable> = {
  [Group in keyof Table]: keyof Table[Group] & string;
}[keyof Table];

/* Variables that share at least one group with Variable. Later entries in a
   APP_VARIABLE_CLASSES list complete against this set, pinned by the first name. */
export type GroupmatesOf<
  Table extends VariableGroupClassTable,
  Variable extends GroupVariableOf<Table>,
> = {
  [Group in keyof Table]: Variable extends keyof Table[Group]
    ? keyof Table[Group] & string
    : never;
}[keyof Table];

/* Groups that define every variable in Variables. The tuple wrapper stops the
   conditional from distributing, which would otherwise match groups that own
   only some of the requested variables. */
export type GroupWithAll<
  Table extends VariableGroupClassTable,
  Variables extends GroupVariableOf<Table>,
> = {
  [Group in keyof Table]: [Variables] extends [keyof Table[Group]]
    ? Group
    : never;
}[keyof Table];

/* Same as GroupWithAll, but names the requested variables when no group
   covers them — instead of collapsing argument two to `never`. */
export type GroupWithAllOrError<
  Table extends VariableGroupClassTable,
  Variables extends GroupVariableOf<Table>,
> = [GroupWithAll<Table, Variables>] extends [never]
  ? `Error: no single group defines all of: ${Variables}`
  : GroupWithAll<Table, Variables>;

export type AssertTrue<Value extends true> = Value;
