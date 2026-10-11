"use client";

import React from "react";
import { cn } from "@/utils";
import { type IconButtonSizeType } from "./button-variants";
import { TooltipButton } from "./tooltip-button";

export const TooltipIconButton = ({
  icon,
  className,
  triggerId,
  size = "icon",
  ...props
}: Omit<React.ComponentProps<typeof TooltipButton>, "children" | "size"> & {
  icon: React.ReactNode;
  size?: IconButtonSizeType;
}) => {
  return (
    <TooltipButton
      size={size}
      className={cn(className)}
      triggerId={triggerId ?? "tooltip-icon-button"}
      {...props}
    >
      {icon}
    </TooltipButton>
  );
};
