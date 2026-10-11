"use client";

import React from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import {
  RadioGroup as RadioGroupPrimitive,
  type RadioGroupProps,
} from "@base-ui/react/radio-group";
import { CircleIcon } from "lucide-react";
import { cn } from "@/utils";

const RadioGroup = <Value,>({
  className,
  ...props
}: RadioGroupProps<Value>) => {
  return (
    <RadioGroupPrimitive<Value>
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
};

const RadioGroupItem = ({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) => {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "relative aspect-square size-4 shrink-0 rounded-full shadow-xs outline-none",
        "text-primary",
        // bg
        "bg-surface",
        // border
        "border-boundary border",
        // disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // focus-visible
        "focus-visible:app-active-ring",
        // aria-invalid
        "app-aria-invalid-border",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="absolute inset-0 flex items-center justify-center"
      >
        <CircleIcon className="fill-primary size-2" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
};

export { RadioGroup, RadioGroupItem };
