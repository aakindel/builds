"use client";

import React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/utils";
import { ConditionalRender } from "@/components/conditional-render";
import { Button } from ".";
import { type IconButtonSizeType } from "./button-variants";

export const IconButton = ({
  icon,
  ariaLabel,
  variant = "ghost",
  size = "icon",
  type = "button",
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "children" | "prefix" | "suffix" | "size"
> & {
  icon: React.ReactNode;
  ariaLabel?: string;
  size?: IconButtonSizeType;
}) => {
  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      className={cn(className)}
      aria-label={ariaLabel}
      {...props}
    >
      {icon}
      <ConditionalRender condition={Boolean(ariaLabel)}>
        <span className="sr-only">{ariaLabel}</span>
      </ConditionalRender>
    </Button>
  );
};

export const XIconButton = ({
  ariaLabel = "Close",
  variant = "ghost",
  size = "icon-xs",
  className,
  ...props
}: Omit<React.ComponentProps<typeof IconButton>, "icon">) => {
  return (
    <IconButton
      variant={variant}
      size={size}
      ariaLabel={ariaLabel}
      className={cn("p-svg-0 text-subdued! shrink-0", className)}
      icon={<XIcon />}
      {...props}
    />
  );
};
