// https://github.com/shadcn-ui/ui/pull/8890 : select exit animations do not work

"use client";

import React from "react";
import {
  Select as SelectPrimitive,
  type SelectRootProps,
} from "@base-ui/react/select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DotIcon,
} from "lucide-react";
import { cn, getAriaProps, getTrueOrUndefined } from "@/utils";
import { useIsPageLoading } from "@/hooks/use-is-page-loading";
import {
  APP_VARIABLE_CLASS,
  APP_VARIABLE_CLASSES,
  SELECT_ICON_CONTAINER_INSET_CLASS,
  SELECT_ICON_CONTAINER_RADIUS_CLASS,
  SELECT_ITEM_PR_CLASS,
  SELECT_ITEM_RADIUS_CLASS,
} from "@/components/alignment";
import { AppBackdrop } from "@/components/app-components";
import { ConditionalRender } from "@/components/conditional-render";

const Select = <Value, Multiple extends boolean | undefined = false>({
  ...props
}: SelectRootProps<Value, Multiple>) => {
  return (
    <SelectPrimitive.Root<Value, Multiple>
      name="select"
      autoComplete="off"
      data-slot="select"
      {...props}
    />
  );
};

const SelectGroup = ({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) => {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
};

const SelectValue = ({
  serverValue,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value> & {
  serverValue?: string;
}) => {
  const { isPageLoading } = useIsPageLoading();
  // return <SelectPrimitive.Value data-slot="select-value" {...props} />;
  return isPageLoading && serverValue ? (
    <span>{serverValue}</span>
  ) : (
    <SelectPrimitive.Value data-slot="select-value" {...props} />
  );
};

const SELECT_SPACING_GROUPS = {
  default: "$select-default",
  sm: "$select-small",
} as const;

const SELECT_ICON_CONTAINER_CLASS =
  "flex size-(--ui-select-icon-container-size) shrink-0 items-center justify-center rounded-(--ui-select-icon-container-radius)";

const SelectTrigger = ({
  className,
  size = "default",
  variant = "default",
  children,
  iconClassName,
  prefix,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Trigger>, "prefix"> & {
  size?: "sm" | "default";
  // UPDATE: shadcn-ui/lint update (new inline variant)
  /* `inline` is a text-like operator control (filter chips), not a field.
     `secondary-subdued` is a filled action chip that sits beside icon buttons
     and borrows the Button variant of the same name. */
  variant?: "default" | "inline" | "secondary-subdued";
  iconClassName?: string;
  prefix?: React.ReactNode;
}) => {
  const triggerId = props.id ?? "select-trigger";
  const hasPrefix = prefix !== undefined;
  const isInline = variant === "inline";
  const isSecondarySubdued = variant === "secondary-subdued";
  /* neither compact variant is a field, so both take the inline spacing scale
     and radius instead of the size scale's field box */
  const isCompact = isInline || isSecondarySubdued;

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      data-prefix={getTrueOrUndefined(hasPrefix)}
      /* the chevron is a permanent suffix, so the suffix inset always applies */
      data-suffix
      className={cn(
        APP_VARIABLE_CLASSES.select(
          [
            "ui-select-py",
            "ui-select-px",
            "ui-select-leading",
            "ui-select-gap",
          ],
          isCompact ? "$select-inline" : SELECT_SPACING_GROUPS[size]
        ),
        APP_VARIABLE_CLASSES.select(
          ["ui-select-icon-container-size", "ui-select-icon-size"],
          "$select-icon-default"
        ),
        APP_VARIABLE_CLASS.select(
          "ui-select-radius",
          isCompact ? "$inline-radius" : "$core-radius"
        ),
        /* defines [--ui-select-icon-container-inset] */
        SELECT_ICON_CONTAINER_INSET_CLASS,
        /* defines [--ui-select-icon-container-radius] */
        SELECT_ICON_CONTAINER_RADIUS_CLASS,
        "flex w-fit items-center justify-between text-sm whitespace-nowrap outline-none",
        "leading-(--ui-select-leading)",
        "rounded-(--ui-select-radius)",
        "gap-(--ui-select-gap)",
        "py-(--ui-select-py)",
        /* inline is a text-like operator: left px, explicit zero right padding.
           secondary-subdued is a filled chip, so it pads both sides evenly.
           default keeps derived prefix/suffix insets. emit exactly one. */
        isInline
          ? "pr-0 pl-(--ui-select-px)"
          : isSecondarySubdued
            ? "px-(--ui-select-px)"
            : cn(
                "pr-(--ui-select-icon-container-inset)",
                hasPrefix
                  ? "pl-(--ui-select-icon-container-inset)"
                  : "pl-(--ui-select-px)"
              ),
        // "shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]",
        // bg
        "bg-surface",
        // border
        "border-boundary border",
        // disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // [&_svg:not([class*='text-'])]
        "[&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--ui-select-icon-size)",
        /* gap on the value slot is inner value spacing; trigger gap is siblings */
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-(--ui-select-gap)",
        // placeholder
        "data-placeholder:text-subdued",
        // focus-visible
        // "focus-visible:border-subdued focus-visible:ring-subdued/50 focus-visible:ring-[3px]",
        "focus-visible:app-active-ring",
        // aria-invalid
        "app-aria-invalid-border",
        cn(
          // UPDATE: shadcn-ui/lint update (new inline variant)
          // inline — compact operator next to a label
          "data-[variant=inline]:h-auto data-[variant=inline]:w-fit",
          "data-[variant=inline]:text-xs data-[variant=inline]:font-semibold data-[variant=inline]:lowercase",
          "data-[variant=inline]:text-muted-foreground",
          "data-[variant=inline]:border-0 data-[variant=inline]:bg-transparent dark:data-[variant=inline]:bg-transparent",
          "data-[variant=inline]:hover:bg-muted data-[variant=inline]:data-popup-open:bg-muted"
        ),
        cn(
          // UPDATE: shadcn-ui/lint update (new secondary-subdued variant)
          /* secondary-subdued — filled action chip beside an icon button. the
             box matches inline (borderless, auto height) so the caller's
             alignment tokens drive the size. */
          "data-[variant=secondary-subdued]:h-auto data-[variant=secondary-subdued]:w-fit",
          "data-[variant=secondary-subdued]:text-xs data-[variant=secondary-subdued]:font-normal",
          "data-[variant=secondary-subdued]:text-muted-foreground",
          "data-[variant=secondary-subdued]:border-0",
          /* color mirrors buttonColorClasses.secondary in
             components/ui/button/button-variants.ts — keep the two in sync. the
             open state reuses the hover mix, which cannot share that string
             because the `hover:` prefix is baked into the Button's copy. */
          "data-[variant=secondary-subdued]:bg-secondary",
          "data-[variant=secondary-subdued]:hover:bg-[color-mix(in_oklch,var(--color-secondary)_97%,black)] dark:data-[variant=secondary-subdued]:hover:bg-[color-mix(in_oklch,var(--color-secondary)_95%,white)]",
          "data-[variant=secondary-subdued]:data-popup-open:bg-[color-mix(in_oklch,var(--color-secondary)_97%,black)] dark:data-[variant=secondary-subdued]:data-popup-open:bg-[color-mix(in_oklch,var(--color-secondary)_95%,white)]"
        ),
        className
      )}
      {...props}
      // use getAriaProps to prevent SSR attribute mismatch hydration warning
      {...getAriaProps({
        id: triggerId,
        returns: ["id"],
      })}
    >
      <ConditionalRender condition={hasPrefix}>
        <span data-slot="select-prefix" className={SELECT_ICON_CONTAINER_CLASS}>
          {prefix}
        </span>
      </ConditionalRender>
      {children}
      <span data-slot="select-suffix" className={SELECT_ICON_CONTAINER_CLASS}>
        <SelectPrimitive.Icon
          render={
            <ChevronDownIcon className={cn("opacity-50", iconClassName)} />
          }
        />
      </span>
    </SelectPrimitive.Trigger>
  );
};

const SelectContent = ({
  className,
  children,
  align = "center",
  alignOffset,
  alignItemWithTrigger = false,
  collisionBoundary,
  collisionAvoidance,
  collisionPadding,
  container,
  disableAnchorTracking,
  positionMethod,
  side = "bottom",
  sideOffset = 4,
  sticky,
  shouldAddBackdrop = false,
  backdropClassName,
  backdropOnClick,
  backdropOnPointerDown,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof SelectPrimitive.Positioner>,
    | "align"
    | "alignOffset"
    | "alignItemWithTrigger"
    | "collisionBoundary"
    | "collisionAvoidance"
    | "collisionPadding"
    | "disableAnchorTracking"
    | "positionMethod"
    | "side"
    | "sideOffset"
    | "sticky"
  > &
  Pick<React.ComponentProps<typeof SelectPrimitive.Portal>, "container"> & {
    shouldAddBackdrop?: boolean;
    backdropClassName?: string;
    backdropOnClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    backdropOnPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  }) => {
  return (
    <SelectPrimitive.Portal container={container}>
      {shouldAddBackdrop ? (
        <SelectPrimitive.Backdrop
          render={<AppBackdrop />}
          className={backdropClassName}
          // caller controls close; base ui does not auto close select
          onClick={backdropOnClick}
          onPointerDown={backdropOnPointerDown}
        />
      ) : null}
      <SelectPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionBoundary={collisionBoundary}
        collisionAvoidance={collisionAvoidance}
        collisionPadding={collisionPadding}
        disableAnchorTracking={disableAnchorTracking}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
        className="isolate z-50 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            APP_VARIABLE_CLASSES.select(
              ["ui-select-content-radius", "ui-select-content-p"],
              "$select-content-default"
            ),
            APP_VARIABLE_CLASSES.select(
              [
                "ui-select-item-py",
                "ui-select-item-pl",
                "ui-select-item-gap",
                "ui-select-item-icon-size",
              ],
              "$select-item-default"
            ),
            APP_VARIABLE_CLASSES.select(
              [
                "ui-select-item-indicator-size",
                "ui-select-item-indicator-inset",
              ],
              "$select-item-indicator-default"
            ),
            /* defines [--ui-select-item-radius] */
            SELECT_ITEM_RADIUS_CLASS,
            /* defines [--ui-select-item-pr] */
            SELECT_ITEM_PR_CLASS,
            "relative min-w-32 overflow-x-hidden overflow-y-auto shadow-md",
            "rounded-(--ui-select-content-radius)",
            // set select content width to trigger (anchor) width
            "w-(--anchor-width)",
            // bg
            "bg-floater text-primary",
            // border
            "border-boundary border",
            "outline-none",
            // data-starting-style
            "data-starting-style:animate-in data-starting-style:fade-in-0 data-starting-style:zoom-in-95",
            // data-ending-style
            "data-ending-style:animate-out data-ending-style:fade-out-0 data-ending-style:zoom-out-95",
            // data[side]
            // "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-(--ui-select-content-p)">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
};

const SelectLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) => {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "text-muted-foreground px-(--ui-select-item-pl) py-(--ui-select-item-py) text-xs",
        className
      )}
      {...props}
    />
  );
};

const SelectItem = ({
  className,
  children,
  shouldUseDotIndicator = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  shouldUseDotIndicator?: boolean;
}) => {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center text-sm outline-none select-none",
        "gap-(--ui-select-item-gap)",
        "py-(--ui-select-item-py) pr-(--ui-select-item-pr) pl-(--ui-select-item-pl)",
        "rounded-(--ui-select-item-radius)",
        // disabled
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        // placeholder
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-(--ui-select-item-gap)",
        // [&_svg]
        "[&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--ui-select-item-icon-size)",
        // focus
        "focus:bg-accent focus:text-primary focus:outline-none",
        className
      )}
      {...props}
    >
      <span className="absolute right-(--ui-select-item-indicator-inset) flex size-(--ui-select-item-indicator-size) items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <ConditionalRender condition={shouldUseDotIndicator}>
            <DotIcon className="size-8" />
          </ConditionalRender>
          <ConditionalRender condition={!shouldUseDotIndicator}>
            <CheckIcon />
          </ConditionalRender>
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
};

const SelectSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) => {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "bg-boundary pointer-events-none -mx-(--ui-select-content-p) my-(--ui-select-content-p) h-px",
        className
      )}
      {...props}
    />
  );
};

const SelectScrollUpButton = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) => {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-(--ui-select-content-p)",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
};

const SelectScrollDownButton = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) => {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-(--ui-select-content-p)",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
};

/* radix select treats `undefined` as uncontrolled and keeps the last value;
   if you're trying to unselect a value, e.g. currentValue === "current",
   with `setSelectValue(condition ? newValue : undefined)`: newValue === "current", but 
   with `setSelectValue(condition ? newValue : SELECT_UNDEFINED_VALUE)`: newValue === "" */
const SELECT_UNDEFINED_VALUE = "";

export {
  SELECT_UNDEFINED_VALUE,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
