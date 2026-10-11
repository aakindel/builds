import React from "react";
import { cn } from "@/utils";
import {
  APP_VARIABLE_CLASS,
  APP_VARIABLE_CLASSES,
} from "@/components/alignment";

export type InputComponentProps = Omit<
  React.ComponentProps<"input">,
  "size"
> & {
  // UPDATE: shadcn-ui/lint update (new compact variant)
  /* Compact filter fields: smaller radius and padding than the aligned sizes. */
  variant?: "default" | "compact";
  shouldHideInvalidStyles?: boolean;
};

const INPUT_SPACING_GROUPS = {
  default: "$input-default",
  compact: "$input-compact",
} as const;

const INPUT_RADIUS_TOKENS = {
  default: "$core-radius",
  compact: "$compact-radius",
} as const;

const Input = ({
  ref,
  className,
  type,
  spellCheck = false,
  variant = "default",
  shouldHideInvalidStyles = false,
  ...props
}: InputComponentProps) => {
  return (
    <input
      type={type}
      name="input"
      autoComplete="off"
      data-slot="input"
      data-variant={variant}
      className={cn(
        APP_VARIABLE_CLASSES.input(
          ["ui-input-py", "ui-input-px", "ui-input-leading", "ui-input-gap"],
          INPUT_SPACING_GROUPS[variant]
        ),
        APP_VARIABLE_CLASS.input(
          "ui-input-radius",
          INPUT_RADIUS_TOKENS[variant]
        ),
        "text-sm leading-(--ui-input-leading)",
        "w-full min-w-0 outline-none",
        "rounded-(--ui-input-radius)",
        "px-(--ui-input-px) py-(--ui-input-py)",
        // bg
        "bg-surface",
        // border
        "border-boundary border",
        // disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // file
        "file:text-primary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // placeholder
        "placeholder:text-subdued",
        // focus-visible
        "focus-visible:app-active-ring",
        // aria-invalid
        !shouldHideInvalidStyles && "app-aria-invalid-border",
        className
      )}
      ref={ref}
      spellCheck={spellCheck}
      {...props}
    />
  );
};

export { Input };
