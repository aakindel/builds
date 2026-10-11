"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";

const labelVariants = cva(
  "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) => {
  return (
    <label
      ref={ref}
      data-slot="label"
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
};

export { Label };
