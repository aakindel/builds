"use client";

import React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/utils";

const TooltipProvider = ({
  delay = 0,
  closeDelay = 0,
  timeout = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={closeDelay}
      timeout={timeout}
      {...props}
    />
  );
};

const Tooltip = ({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) => {
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      disableHoverablePopup={true}
      {...props}
    />
  );
};

const TooltipTrigger = ({
  ref,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) => {
  return (
    <TooltipPrimitive.Trigger
      // ref used for DragHandleMenu trigger
      ref={ref}
      data-slot="tooltip-trigger"
      {...props}
    />
  );
};

const TooltipContent = ({
  ref,
  className,
  sideOffset = 6,
  align,
  alignOffset,
  anchor,
  children,
  collisionAvoidance,
  collisionBoundary,
  collisionPadding,
  positionMethod,
  side,
  sticky,
  portalContainer,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
  /* mounts the popup inside this element instead of the body, e.g. when the
     trigger sits in a fullscreen or top-layer subtree the body cannot paint over */
  portalContainer?: React.ComponentProps<
    typeof TooltipPrimitive.Portal
  >["container"];
} & Pick<
    React.ComponentProps<typeof TooltipPrimitive.Positioner>,
    | "align"
    | "alignOffset"
    | "anchor"
    | "collisionAvoidance"
    | "collisionBoundary"
    | "collisionPadding"
    | "positionMethod"
    | "side"
    | "sideOffset"
    | "sticky"
  >) => {
  return (
    <TooltipPrimitive.Portal container={portalContainer}>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
        className="isolate z-50 outline-none"
      >
        <TooltipPrimitive.Popup
          // ref used for SidebarResizeHandle tooltip
          ref={ref}
          data-slot="tooltip-content"
          className={cn(
            "w-fit origin-(--transform-origin) cursor-default rounded-md px-2 py-1.25 text-xs text-balance",
            // bg
            "bg-floater",
            "text-primary",
            // border
            "border-boundary border",
            // base animations
            // "data-starting-style:animate-in data-starting-style:fade-in-0 data-starting-style:zoom-in-95 data-ending-style:animate-out data-ending-style:fade-out-0 data-ending-style:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          {children}
          {/* https://dev.to/jestsee/hacky-way-to-customize-shadcns-tooltip-arrows-1kej */}
          {/* <TooltipPrimitive.Arrow
          className={cn(
            "bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]",
            "border border-l-0 border-t-0 border-boundary",
            "bg-floater",
            "fill-floater"
          )}
        /> */}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
};

const TOOLTIP_DELAY_BASE = 250;

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TOOLTIP_DELAY_BASE,
};
