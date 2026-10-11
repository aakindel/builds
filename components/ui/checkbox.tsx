"use client";

import React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/utils";

const Checkbox = ({
  className,
  checked,
  shouldUseOutlineIndeterminate = true,
  ...props
}: Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  "checked" | "indeterminate"
> & {
  checked?: boolean | "indeterminate";
  shouldUseOutlineIndeterminate?: boolean;
}) => {
  const isIndeterminate = checked === "indeterminate";

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={isIndeterminate ? false : checked}
      indeterminate={isIndeterminate}
      className={cn(
        // grid + place-content-center: center indicator (block top-aligned it)
        "peer grid size-4 shrink-0 place-content-center rounded-xs outline-none",
        // bg
        "bg-surface",
        // border
        "border-boundary border",
        // disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // data-checked / data-indeterminate
        cn(
          // bg
          "data-checked:bg-primary",
          !shouldUseOutlineIndeterminate && "data-indeterminate:bg-primary",
          // text
          "data-checked:text-primary-foreground",
          shouldUseOutlineIndeterminate
            ? "data-indeterminate:text-dim"
            : "data-indeterminate:text-primary-foreground",
          // border
          "data-checked:border-transparent",
          !shouldUseOutlineIndeterminate &&
            "data-indeterminate:border-transparent"
        ),
        // focus-visible
        "focus-visible:app-active-ring",
        // aria-invalid
        "app-aria-invalid-border",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {isIndeterminate ? (
          <MinusIcon className="size-3 stroke-3" />
        ) : (
          <CheckIcon className="size-3 stroke-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
