"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input, type InputComponentProps } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  APP_VARIABLE_CLASS,
  APP_VARIABLE_CLASSES,
  INPUT_GROUP_INHERIT_GAP_CLASS,
  INPUT_GROUP_INHERIT_LEADING_CLASS,
  INPUT_GROUP_INHERIT_PX_CLASS,
  INPUT_GROUP_INHERIT_PY_CLASS,
  INPUT_GROUP_INHERIT_RADIUS_CLASS,
  INPUT_ICON_CONTAINER_INSET_CLASS,
  INPUT_ICON_CONTAINER_RADIUS_CLASS,
} from "@/components/alignment";

const InputGroup = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        APP_VARIABLE_CLASSES.input(
          ["ui-input-py", "ui-input-px", "ui-input-leading", "ui-input-gap"],
          "$input-default"
        ),
        APP_VARIABLE_CLASSES.input(
          ["ui-input-icon-container-size", "ui-input-icon-size"],
          "$input-icon-default"
        ),
        APP_VARIABLE_CLASS.input("ui-input-radius", "$core-radius"),
        /* defines [--ui-input-icon-container-inset] */
        INPUT_ICON_CONTAINER_INSET_CLASS,
        /* defines [--ui-input-icon-container-radius] */
        INPUT_ICON_CONTAINER_RADIUS_CLASS,

        "group/input-group relative flex w-full items-center rounded-(--ui-input-radius) outline-none",

        // "h-9 has-[>textarea]:h-auto",
        "h-auto",

        // "transition-[color,box-shadow]",
        "shadow-none",

        // bg
        "bg-surface",

        // border
        "border-boundary border",

        // variants based on alignment
        "has-[>[data-align=inline-start]]:[&>input]:pl-(--ui-input-gap)",
        "has-[>[data-align=inline-end]]:[&>input]:pr-(--ui-input-gap)",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // focus-within: ring the group when the inner control (or button) is focused
        "focus-within:app-active-ring",

        // invalid: red border at rest; swap to invalid ring when focused
        // (mirrors Input's app-aria-invalid-border — ring glow must not show unfocused)
        "has-[[data-slot][aria-invalid=true]]:border-destructive-emphasis/80 dark:has-[[data-slot][aria-invalid=true]]:border-red-500/60",
        "has-[[data-slot][aria-invalid=true]]:ring-destructive-emphasis/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive-emphasis/40",
        "has-[[data-slot][aria-invalid=true]]:focus-within:app-invalid-ring!",

        className
      )}
      {...props}
    />
  );
};

const inputGroupAddonVariants = cva(
  cn(
    "group/input-group-addon text-subdued flex h-auto cursor-text items-center justify-center gap-2 text-sm font-medium select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-(--ui-input-icon-size)",
    /* defines [--ui-input-icon-container-inset] */
    INPUT_ICON_CONTAINER_INSET_CLASS,
    /* defines [--ui-input-icon-container-radius] */
    INPUT_ICON_CONTAINER_RADIUS_CLASS
    // "py-(--ui-input-icon-container-inset)",
    // "pr-(--ui-input-icon-container-inset)"
  ),
  {
    variants: {
      align: {
        /* Inline addons use the derived icon-container inset. Action buttons
           consume the addon's --ui-input-icon-container-size. */
        "inline-start":
          // "order-first pl-3 has-[>kbd]:ml-[-0.35rem] has-[>svg]:pl-2.5",
          "py-(--ui-input-icon-container-inset) pl-(--ui-input-icon-container-inset)",
        "inline-end":
          // "order-last pr-3 has-[>kbd]:mr-[-0.35rem] has-[>svg]:pr-2.5",
          "py-(--ui-input-icon-container-inset) pr-(--ui-input-icon-container-inset)",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
);

const INPUT_GROUP_ACTION_SIZE_GROUPS = {
  default: "$input-icon-button",
  small: "$input-icon-button-small",
} as const;

const InputGroupAddon = ({
  className,
  align = "inline-start",
  treatment = "inset",
  shouldBlurInputOnAddonClick = false,
  actionSize,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants> & {
    treatment?: "inset" | "segment";
    shouldBlurInputOnAddonClick?: boolean;
    /* Action child of this addon: default is 24px, small is 20px. Omitted
       keeps ordinary addon icon geometry. */
    actionSize?: "default" | "small";
  }) => {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      data-treatment={treatment}
      data-action-size={actionSize}
      className={cn(
        actionSize !== undefined &&
          APP_VARIABLE_CLASSES.input(
            ["ui-input-icon-container-size", "ui-input-icon-size"],
            INPUT_GROUP_ACTION_SIZE_GROUPS[actionSize]
          ),
        inputGroupAddonVariants({ align }),
        treatment === "segment" &&
          "border-boundary self-stretch rounded-l-none rounded-r-(--ui-input-radius) border-l p-0",
        className
      )}
      onMouseDown={(e) => {
        if (shouldBlurInputOnAddonClick) {
          return;
        }
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.preventDefault();
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
};

/* Action child of InputGroupAddon with actionSize set. Consumes the addon's
   container, icon, and radius variables. */
const InputGroupButton = ({
  className,
  type = "button",
  variant = "ghost",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size">) => {
  return (
    <Button
      type={type}
      data-slot="input-group-button"
      variant={variant}
      className={cn(
        "flex items-center gap-2 text-sm shadow-none",
        "size-(--ui-input-icon-container-size) p-0 py-0 leading-none",
        "[&_svg:not([class*='size-'])]:size-(--ui-input-icon-size)",
        "rounded-(--ui-input-icon-container-radius)",
        // focus-visible
        "focus-visible:app-active-ring",
        /* keep the button clickable if a parent sets pointer-events-none */
        "pointer-events-auto",
        "group-data-[treatment=segment]/input-group-addon:h-full group-data-[treatment=segment]/input-group-addon:min-w-9 group-data-[treatment=segment]/input-group-addon:rounded-l-none group-data-[treatment=segment]/input-group-addon:rounded-r-(--ui-input-radius)",
        className
      )}
      {...props}
    />
  );
};

const InputGroupText = ({
  className,
  ...props
}: React.ComponentProps<"span">) => {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-(--ui-input-icon-size)",
        className
      )}
      {...props}
    />
  );
};

const InputGroupInput = ({
  ref,
  className,
  ...props
}: Omit<InputComponentProps, "variant">) => {
  return (
    <Input
      // ref used for focusing input when InputGroupButton is clicked
      ref={ref}
      variant="default"
      name="input-group-input"
      data-slot="input-group-control"
      className={cn(
        INPUT_GROUP_INHERIT_PY_CLASS,
        INPUT_GROUP_INHERIT_PX_CLASS,
        INPUT_GROUP_INHERIT_LEADING_CLASS,
        INPUT_GROUP_INHERIT_GAP_CLASS,
        INPUT_GROUP_INHERIT_RADIUS_CLASS,
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-0 dark:bg-transparent",
        className
      )}
      spellCheck={false}
      shouldHideInvalidStyles
      {...props}
    />
  );
};

const InputGroupTextarea = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"textarea">) => {
  return (
    <Textarea
      // ref used for focusing textarea when InputGroupButton is clicked
      ref={ref}
      name="input-group-textarea"
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  );
};

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
