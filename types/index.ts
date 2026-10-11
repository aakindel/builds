import { type LucideIcon } from "lucide-react";
import { type AppLucideIconName } from "@/components/icons";

// https://stackoverflow.com/a/59230299 : disallow excess properties
export type ExactlyType<T, U> = T & Record<Exclude<keyof U, keyof T>, never>;

// https://stackoverflow.com/a/52520678 : exclude properties from type
export type Without<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// https://stackoverflow.com/a/65015914 : alter partial type
type PartialNeverType<T> = { [P in keyof T]?: never };

// useful if all of T is present or none of T is present
export type TypeOrNeverType<T> = T | PartialNeverType<T>;

// useful if when T is present, U is not present and vice versa
export type TypeNeverOtherType<T, U> =
  (T & PartialNeverType<U>) | (U & PartialNeverType<T>);

// https://stackoverflow.com/a/53453116 : nullable type
export type NullableType<T> = T | null;

// https://stackoverflow.com/a/57548987 : require generic parameter
export const typeCheckExact = <T = void, U extends T = T>(value: U): U => {
  return value as U;
};

// https://stackoverflow.com/a/54160691 : return A if A === B, else never
export type ExactTypeOrNever<A, B> =
  (<T>() => T extends A ? 1 : 0) extends <T>() => T extends B ? 1 : 0
    ? A extends B
      ? B extends A
        ? A
        : never
      : never
    : never;

// https://stackoverflow.com/a/73461648 : returns never if A === B
export type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A>;

// https://stackoverflow.com/a/73461648 : shows error if T is not nevers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertType<T extends never>() {}

export type AppColorType =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "fuchsia"
  | "gray"
  | "green"
  | "indigo"
  | "lime"
  | "neutral"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "rose"
  | "sky"
  | "slate"
  | "stone"
  | "teal"
  | "violet"
  | "yellow"
  | "zinc";

export type AppBasicTagType = {
  slug: string;
  title?: string;
  color: AppColorType;
};

export type AppFilterType =
  | "text"
  | "number"
  // | "range"
  | "date"
  // | "dateRange"
  // | "boolean"
  | "multiselect"
  | "select";

// type from react-querybuilder (do not modify)
export type AppFilterOperatorType =
  | "="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "contains"
  | "beginsWith"
  | "endsWith"
  | "doesNotContain"
  | "doesNotBeginWith"
  | "doesNotEndWith"
  | "null"
  | "notNull"
  | "in"
  | "notIn"
  | "between"
  | "notBetween";

export type FieldOptionType = { id: string; title: string };
export type FieldOptionAppTagType = {
  id: string;
  title: string;
  color: AppColorType;
  badge: "dot" | "color";
};
export type FieldOptionAppFilterType = {
  id: AppFilterOperatorType;
  title: string;
};
export type FieldOptionDescriptionType = {
  id: string;
  title: string;
  description: string;
};

export type DemoPageItemType = {
  title: string;
  slug: string;
  href: string;
  hasScreenshot?: boolean;
};

export type AppSidebarItemType = {
  title: string;
  url?: string;
  icon: LucideIcon | AppLucideIconName;
  isActive?: boolean;
  shouldOpenInNewTab?: boolean;
  isDefaultCollapsed?: boolean;
  items?: AppSidebarItemType[];
};
