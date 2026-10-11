"use client";

import React from "react";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";

const separatorVariants = cva("shrink-0", {
  variants: {
    variant: {
      default: "bg-boundary",
      subtle: "bg-subtle",
    },
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-full w-px",
    },
  },
  defaultVariants: {
    variant: "default",
    orientation: "horizontal",
  },
});

const Separator = ({
  ref,
  className,
  orientation = "horizontal",
  variant = "default",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> &
  VariantProps<typeof separatorVariants>) => {
  return (
    <SeparatorPrimitive
      ref={ref}
      data-slot="separator"
      data-variant={variant}
      orientation={orientation}
      className={cn(separatorVariants({ variant, orientation }), className)}
      {...props}
    />
  );
};

export { Separator };
