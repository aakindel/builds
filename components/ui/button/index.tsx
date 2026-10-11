"use client";

import React, { useEffect, useState } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";
import { cn, getTrueOrUndefined } from "@/utils";
import {
  BUTTON_ICON_CONTAINER_INSET_CLASS,
  BUTTON_ICON_CONTAINER_RADIUS_CLASS,
} from "@/components/alignment";
import { ConditionalRender } from "@/components/conditional-render";
import { Icons } from "../../icons";
import { buttonVariants, type IconButtonSizeType } from "./button-variants";
import { IconButton, XIconButton } from "./icon-button";
import { TooltipButton } from "./tooltip-button";
import { TooltipIconButton } from "./tooltip-icon-button";

const Button = ({
  className,
  variant = "default",
  size = "default",
  shape = "square",
  nativeButton,
  render,
  disabled,
  isLoading = false,
  loadingDelay,
  onClick,
  ref,
  prefix,
  suffix,
  shouldPreventActiveScale = false,
  children,
  ...props
}: Omit<ButtonPrimitive.Props, "prefix"> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean;
    loadingDelay?: number;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    shouldPreventActiveScale?: boolean;
  }) => {
  /* delayedIsLoading lags isLoading by `loadingDelay` so brief loads can skip a spinner flash.
     Example with loadingDelay=1000ms and a 3s load:
       t=0s  isLoading=true  → delayedIsLoading stays false, timeout scheduled
       t=1s  timeout fires   → delayedIsLoading becomes true
       t=3s  isLoading=false → delayedIsLoading cleared immediately when isLoading clears */
  const [delayedIsLoading, setDelayedIsLoading] = useState(false);

  useEffect(() => {
    // Loading ended: clear delayed state right away (do not wait out remaining delay)
    if (!isLoading) {
      setDelayedIsLoading(false);
      return;
    }

    // No delay configured: treat loading as visible immediately
    if (!loadingDelay) {
      setDelayedIsLoading(true);
      return;
    }

    // Still loading: only flip delayedIsLoading after the delay elapses
    const timeoutId = setTimeout(() => {
      setDelayedIsLoading(true);
    }, loadingDelay);

    /* If isLoading clears (or delay changes) before the timeout, cancel it so we never
       set delayedIsLoading=true after loading has already finished */
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, loadingDelay]);

  const showLoadingIcon = loadingDelay ? delayedIsLoading : isLoading;
  const prefixContent = showLoadingIcon ? <Icons.spinner /> : prefix;
  const hasPrefix = prefix !== undefined || showLoadingIcon;
  const hasSuffix = suffix !== undefined;
  const isLabeledSize = !isIconButtonSize(size);
  const useLeftoverInset = isLabeledSize && variant !== "link";

  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      data-size={size}
      className={cn(
        !shouldPreventActiveScale && "transition-transform active:scale-98",
        buttonVariants({ variant, size, shape }),
        /* defines [--ui-button-icon-container-inset] */
        useLeftoverInset && BUTTON_ICON_CONTAINER_INSET_CLASS,
        /* defines [--ui-button-icon-container-radius] */
        useLeftoverInset && BUTTON_ICON_CONTAINER_RADIUS_CLASS,
        /* suffix/prefix: do not follow pl/pr with a later px — later px
           removes earlier pl/pr. no affix: leave the size variant's
           px-(--ui-button-px) */
        useLeftoverInset &&
          (hasPrefix
            ? "pl-(--ui-button-icon-container-inset)"
            : hasSuffix && "pl-(--ui-button-px)"),
        useLeftoverInset &&
          (hasSuffix
            ? "pr-(--ui-button-icon-container-inset)"
            : hasPrefix && "pr-(--ui-button-px)"),
        className
      )}
      disabled={disabled}
      data-variant={variant}
      data-disabled={getTrueOrUndefined(Boolean(disabled))}
      // disabled={disabled || isLoading}
      // data-disabled={getTrueOrUndefined(Boolean(disabled || isLoading))}
      data-prefix={getTrueOrUndefined(hasPrefix)}
      data-suffix={getTrueOrUndefined(hasSuffix)}
      data-loading={getTrueOrUndefined(isLoading)}
      /* Base UI defaults nativeButton to true; when `render` replaces the host
         (e.g. Link), opt out so useButton does not expect a <button> tag */
      nativeButton={nativeButton ?? render === undefined}
      render={render}
      {...props}
      onClick={(event) => {
        if (disabled || isLoading || delayedIsLoading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <ConditionalRender condition={hasPrefix}>
        <div
          data-prefix-container
          className={
            useLeftoverInset
              ? BUTTON_ICON_CONTAINER_CLASS
              : "flex items-center justify-center"
          }
        >
          {prefixContent}
        </div>
      </ConditionalRender>
      {children}
      <ConditionalRender condition={hasSuffix}>
        <div
          data-suffix-container
          className={
            useLeftoverInset
              ? BUTTON_ICON_CONTAINER_CLASS
              : "flex items-center justify-center"
          }
        >
          {suffix}
        </div>
      </ConditionalRender>
    </ButtonPrimitive>
  );
};

const BUTTON_ICON_CONTAINER_CLASS =
  "flex size-(--ui-button-icon-container-size) shrink-0 items-center justify-center rounded-(--ui-button-icon-container-radius)";

function isIconButtonSize(
  size: VariantProps<typeof buttonVariants>["size"]
): size is IconButtonSizeType {
  return size === "icon" || size === "icon-sm" || size === "icon-xs";
}

export { Button, IconButton, TooltipButton, TooltipIconButton, XIconButton };
