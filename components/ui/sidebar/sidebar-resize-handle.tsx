import React, { useEffect, useRef, useState } from "react";
import { cn, getAriaProps } from "@/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SidebarResizeHandleVariant = "default" | "highlight";

type SidebarResizeHandleProps = {
  sidebarSide: "left" | "right";
  sidebarId?: string;
  sidebarWidth: number;
  isSidebarExpanded: boolean;
  isMobileOrNonHoverDevice?: boolean;
  onSidebarWidthChange: (sidebarWidth: number) => void;
  offset?: number;
  isFloating?: boolean;
  variant?: SidebarResizeHandleVariant;
  insetDirection?: "left" | "right";
};

const TOOLTIP_VIEWPORT_PADDING = 8;

// sidebar handle ::after: fading at both ends.
const HIGHLIGHT_BORDER_GRADIENT =
  "linear-gradient(to bottom, oklch(var(--sidebar-resize-highlight-l) 0 0 / 0) 0%, oklch(var(--sidebar-resize-highlight-l) 0 0 / 0.5) 15%, oklch(var(--sidebar-resize-highlight-l) 0 0 / 0.65) 50%, oklch(var(--sidebar-resize-highlight-l) 0 0 / 0.5) 85%, oklch(var(--sidebar-resize-highlight-l) 0 0 / 0) 100%)";

export const SidebarResizeHandle = ({
  sidebarSide,
  sidebarId,
  sidebarWidth,
  isSidebarExpanded,
  isMobileOrNonHoverDevice = false,
  onSidebarWidthChange,
  offset = 0,
  isFloating = false,
  variant = "default",
  insetDirection,
}: SidebarResizeHandleProps) => {
  const handleRef = useRef<HTMLDivElement>(null);
  const tooltipPointerClientYRef = useRef<number | null>(null);
  const openDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Last pointermove clientX (mx), compared to pointerup clientX (ux) below.
  const lastPointerMoveClientXRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);
  // True once the user has moved the handle horizontally during this interaction.
  const isDraggingRef = useRef(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const tooltipDelayDuration = 100;
  const tooltipHeightOffset = 15;
  const isHighlight = variant === "highlight";
  const shouldHideTooltip = !isSidebarExpanded || isMobileOrNonHoverDevice;

  const resizeHitAreaWidth = 7;
  const resizeHandleWidth = isHighlight ? 1 : 3;
  const resizeHandleBase =
    offset + sidebarWidth - Math.ceil(resizeHitAreaWidth / 2);
  const resizeHandlePosition = isFloating
    ? `calc(${resizeHandleBase}px - var(--ui-sidebar-layout-inset-gap))`
    : `${resizeHandleBase}px`;

  // Left handle: tooltip on the right. Right handle: tooltip on the left.
  const tooltipSide = sidebarSide === "left" ? "right" : "left";
  const resizeHandleTriggerId = sidebarId
    ? `sidebar-resize-handle-${sidebarId}`
    : `sidebar-resize-handle-${sidebarSide}`;

  function clearOpenDelayTimeout() {
    if (openDelayTimeoutRef.current) {
      clearTimeout(openDelayTimeoutRef.current);
      openDelayTimeoutRef.current = null;
    }
  }

  function scheduleTooltipOpen() {
    clearOpenDelayTimeout();
    openDelayTimeoutRef.current = setTimeout(() => {
      setIsTooltipOpen(true);
      openDelayTimeoutRef.current = null;
    }, tooltipDelayDuration);
  }

  function getTooltipAnchor() {
    const handleRect = handleRef.current?.getBoundingClientRect();
    if (!handleRect) {
      return null;
    }

    const anchorX = sidebarSide === "left" ? handleRect.right : handleRect.left;
    const rawAnchorY =
      (tooltipPointerClientYRef.current ?? handleRect.top) -
      tooltipHeightOffset;
    const anchorY = Math.min(
      window.innerHeight - TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, rawAnchorY)
    );

    return {
      getBoundingClientRect: () => ({
        x: anchorX,
        y: anchorY,
        top: anchorY,
        right: anchorX,
        bottom: anchorY,
        left: anchorX,
        width: 0,
        height: 0,
      }),
    };
  }

  function isPointerOverHandle(clientX: number, clientY: number) {
    const handleRect = handleRef.current?.getBoundingClientRect();
    if (!handleRect) {
      return false;
    }

    return (
      clientX >= handleRect.left - 1 &&
      clientX <= handleRect.right &&
      clientY >= handleRect.top &&
      clientY <= handleRect.bottom
    );
  }

  useEffect(() => {
    if (!isTooltipOpen || isPointerDown) {
      return;
    }

    // While the tooltip is open, hide it as soon as the pointer leaves the handle.
    function handlePointerMove(pointerEvent: PointerEvent) {
      lastPointerMoveClientXRef.current = pointerEvent.clientX;
      if (isPointerOverHandle(pointerEvent.clientX, pointerEvent.clientY)) {
        tooltipPointerClientYRef.current = pointerEvent.clientY;
        return;
      }

      clearOpenDelayTimeout();
      setIsTooltipOpen(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [isPointerDown, isTooltipOpen]);

  useEffect(() => {
    if (!shouldHideTooltip) {
      return;
    }

    clearOpenDelayTimeout();
    setIsTooltipOpen(false);
  }, [shouldHideTooltip]);

  useEffect(() => {
    return () => {
      clearOpenDelayTimeout();
    };
  }, []);

  // Cursor is hit-tested from the element under the pointer, so the handle's
  // cursor-col-resize is lost as soon as the pointer leaves the 7px hit target.
  useEffect(() => {
    if (!isPointerDown) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.textContent =
      "*,*::before,*::after{cursor:col-resize!important;}";
    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, [isPointerDown]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    setIsPointerDown(true);
    clearOpenDelayTimeout();
    setIsTooltipOpen(false);

    const startingWidth = sidebarWidth;
    const startingClientX = event.clientX;

    function handlePointerMove(pointerEvent: PointerEvent) {
      lastPointerMoveClientXRef.current = pointerEvent.clientX;

      const delta =
        sidebarSide === "left"
          ? pointerEvent.clientX - startingClientX
          : startingClientX - pointerEvent.clientX;

      if (delta !== 0) {
        isDraggingRef.current = true;
      }

      onSidebarWidthChange(startingWidth + delta);
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      isPointerDownRef.current = false;
      tooltipPointerClientYRef.current = pointerEvent.clientY;
      setIsPointerDown(false);

      window.requestAnimationFrame(() => {
        if (isPointerDownRef.current) {
          return;
        }

        // After a quick drag, mx can equal ux even though the handle moved under
        // a stationary pointer. Reopening here would leave the tooltip stuck
        // visible with no later pointermove to close it. Clicks are unaffected
        // because isDraggingRef stays false when delta is 0.
        if (
          isDraggingRef.current &&
          lastPointerMoveClientXRef.current === pointerEvent.clientX
        ) {
          setIsTooltipOpen(false);
          isDraggingRef.current = false;
          return;
        }

        isDraggingRef.current = false;

        // Plain click: reopen only if the pointer is still over the handle.
        setIsTooltipOpen(
          isPointerOverHandle(pointerEvent.clientX, pointerEvent.clientY)
        );
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    /* TooltipTrigger delay is ignored here: the sidebar TooltipProvider uses
       delay={0} and its delay group forces instant opens. This tooltip is
       controlled via open/onOpenChange, so we apply tooltipDelayDuration
       ourselves before setting isTooltipOpen. */
    <Tooltip
      open={isTooltipOpen && !isPointerDown && !shouldHideTooltip}
      onOpenChange={(open) => {
        // Ignore hover-open while pressed, collapsed, or on mobile.
        if (isPointerDown || shouldHideTooltip) {
          return;
        }

        if (open) {
          scheduleTooltipOpen();
          return;
        }

        clearOpenDelayTimeout();
        setIsTooltipOpen(false);
      }}
    >
      <TooltipTrigger
        // Base UI trigger delay is disabled; open timing is handled above via
        // scheduleTooltipOpen() and tooltipDelayDuration in onOpenChange.
        delay={0}
        render={
          <div
            ref={handleRef}
            data-testid="sidebar-resize-handle"
            className={cn(
              "fixed top-0 bottom-0 z-35 block h-full cursor-col-resize touch-none",
              "after:pointer-events-none after:absolute after:left-[calc(50%-var(--sidebar-resize-handle-width)/2)] after:w-(--sidebar-resize-handle-width) after:opacity-0 after:transition-opacity after:content-['']",
              "hover:after:opacity-100",
              "after:duration-150",
              isPointerDown && "after:opacity-100",
              isHighlight
                ? cn(
                    "[--sidebar-resize-highlight-l:0.75] after:top-3.5 after:bottom-10 after:rounded-xs after:bg-(image:--sidebar-resize-highlight) after:mix-blend-overlay dark:[--sidebar-resize-highlight-l:0.5]",
                    insetDirection === "left" && "after:translate-x-px",
                    insetDirection === "right" && "after:-translate-x-px"
                  )
                : "after:bg-dim after:inset-y-0 after:rounded-none",
              !isSidebarExpanded && "hidden"
            )}
            style={
              {
                width: `${resizeHitAreaWidth}px`,
                left: sidebarSide === "left" ? resizeHandlePosition : "auto",
                right: sidebarSide === "right" ? resizeHandlePosition : "auto",
                "--sidebar-resize-handle-width": `${resizeHandleWidth}px`,
                ...(isHighlight && {
                  "--sidebar-resize-highlight": HIGHLIGHT_BORDER_GRADIENT,
                }),
              } as React.CSSProperties
            }
            onPointerDown={handlePointerDown}
            onPointerEnter={(event) => {
              tooltipPointerClientYRef.current = event.clientY;
            }}
          />
        }
        // use getAriaProps to prevent SSR attribute mismatch hydration warning
        {...getAriaProps({
          id: resizeHandleTriggerId,
          returns: ["id"],
        })}
      />
      <TooltipContent
        anchor={getTooltipAnchor}
        side={tooltipSide}
        align="start"
        collisionAvoidance={{
          side: "none",
          align: "shift",
          fallbackAxisSide: "none",
        }}
        collisionPadding={TOOLTIP_VIEWPORT_PADDING}
        positionMethod="fixed"
        hidden={shouldHideTooltip}
      >
        <p className="text-center text-xs">Drag to Resize</p>
      </TooltipContent>
    </Tooltip>
  );
};
