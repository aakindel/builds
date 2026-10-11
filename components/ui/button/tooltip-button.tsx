"use client";

import React, { useCallback, useRef } from "react";
import Link from "next/link";
import { cn, getAriaProps, openUrlInNewTab } from "@/utils";
import { useCanHover } from "@/hooks/use-can-hover";
import { useTooltipContentVisibility } from "@/hooks/use-tooltip-content-visibility";
import {
  Tooltip,
  TOOLTIP_DELAY_BASE,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConditionalRender } from "@/components/conditional-render";
import { Button } from ".";
import { type ButtonVariantType } from "./button-variants";

export const TooltipButton = ({
  ref,
  delay = TOOLTIP_DELAY_BASE,
  tooltipText,
  ariaLabel,
  side,
  type,
  variant,
  disabled,
  className,
  contentClassName,
  tabIndex = 0,
  sideOffset,
  href,
  onClick,
  shouldHideContent = false,
  shouldShowOnNonHoverDevices = false,
  shouldIncludeTooltipProvider = true,
  triggerId,
  portalContainer,
  children,
  ...props
}: React.ComponentProps<typeof Button> &
  Pick<React.ComponentProps<typeof TooltipContent>, "portalContainer"> & {
    delay?: number;
    tooltipText: string | React.ReactNode;
    ariaLabel?: string;
    triggerId?: string;
    side?: "left" | "right" | "bottom" | "top";
    type?: "button" | "submit" | "reset";
    variant?: ButtonVariantType | null;
    disabled?: boolean;
    className?: string;
    contentClassName?: string;
    tabIndex?: number;
    sideOffset?: number;
    href?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    shouldHideContent?: boolean;
    shouldShowOnNonHoverDevices?: boolean;
    /* when shouldIncludeTooltipProvider is false, user provides external TooltipProvider;
     external TooltipProvider is used to group tooltips (via base ui FloatingDelayGroup):
     once one tooltip is open, others in the same provider open immediately w/o delay */
    shouldIncludeTooltipProvider?: boolean;
  }) => {
  const tooltipTriggerRef = useRef<HTMLButtonElement>(null);

  // keeps the internal trigger ref working when a caller also passes `ref`
  const setTooltipTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      tooltipTriggerRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  // handles focusing trigger/parent to show/hide tooltip content
  useTooltipContentVisibility({ tooltipTriggerRef });

  const { canHover } = useCanHover();

  const tooltipTriggerId = triggerId ?? "tooltip-button";

  const resolvedAriaLabel =
    ariaLabel ?? (typeof tooltipText === "string" ? tooltipText : undefined);

  const tooltip = (
    <Tooltip>
      <div tabIndex={-1} className="relative h-fit w-fit focus:outline-none">
        <TooltipTrigger
          render={
            href ? (
              onClick ? (
                <Button
                  ref={setTooltipTriggerRef}
                  type={type ?? "button"}
                  variant={variant ?? "ghost"}
                  disabled={disabled}
                  className={className}
                  aria-label={resolvedAriaLabel}
                  onClick={(event) => {
                    onClick(event);
                    setTimeout(() => {
                      openUrlInNewTab(href);
                    }, 0);
                  }}
                  tabIndex={tabIndex}
                  {...props}
                />
              ) : (
                <Button
                  ref={setTooltipTriggerRef}
                  type={type ?? "button"}
                  variant={variant ?? "ghost"}
                  disabled={disabled}
                  className={className}
                  aria-label={resolvedAriaLabel}
                  tabIndex={tabIndex}
                  {...props}
                  render={
                    <Link
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                />
              )
            ) : (
              <Button
                ref={setTooltipTriggerRef}
                type={type ?? "button"}
                variant={variant ?? "ghost"}
                disabled={disabled}
                className={className}
                aria-label={resolvedAriaLabel}
                onClick={onClick}
                tabIndex={tabIndex}
                {...props}
              />
            )
          }
          // use getAriaProps to prevent SSR attribute mismatch hydration warning
          {...getAriaProps({
            id: tooltipTriggerId,
            returns: ["id"],
          })}
        >
          {children}
        </TooltipTrigger>
      </div>
      <ConditionalRender
        condition={
          (canHover || shouldShowOnNonHoverDevices) && !shouldHideContent
        }
      >
        <TooltipContent
          className={cn(contentClassName)}
          side={side}
          sideOffset={sideOffset}
          portalContainer={portalContainer}
        >
          {typeof tooltipText === "string" ? <p>{tooltipText}</p> : tooltipText}
        </TooltipContent>
      </ConditionalRender>
    </Tooltip>
  );

  if (!shouldIncludeTooltipProvider) {
    return tooltip;
  }

  return <TooltipProvider delay={delay}>{tooltip}</TooltipProvider>;
};
