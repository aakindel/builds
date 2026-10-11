"use client";

import { startTransition, useEffect, useState } from "react";
import { useDrag } from "@use-gesture/react";

// import { DEFAULT_SIDEBAR_INITIAL_WIDTH } from "..";

const DEFAULT_SIDEBAR_INITIAL_WIDTH = 320;

type UseAppSidebarResizeProps = {
  initialSize: number | undefined;
  minSize: number | (() => number);
  maxSize: number | (() => number);
  sidebarSide: "left" | "right";
  isSidebarExpanded: boolean;
  setSidebarWidth?: (sidebarLeftWidth: number) => void;
};

export function useAppSidebarResize({
  initialSize,
  minSize,
  maxSize,
  sidebarSide,
  setSidebarWidth,
  isSidebarExpanded,
}: UseAppSidebarResizeProps) {
  const [sidebarSize, setSidebarSize] = useState(
    initialSize ?? DEFAULT_SIDEBAR_INITIAL_WIDTH
  );
  const resizeDirection = sidebarSide === "left" ? "right" : "left";

  useEffect(() => {
    if (sidebarSize === undefined) {
      setSidebarSize(initialSize ?? DEFAULT_SIDEBAR_INITIAL_WIDTH);
    }
  }, [initialSize, sidebarSize]);

  useEffect(() => {
    function setBreakpointBoolean() {
      if (sidebarSize !== undefined) {
        if (sidebarSide && setSidebarWidth) {
          setSidebarWidth(sidebarSize);
        }
      }
    }

    setBreakpointBoolean();

    window.addEventListener("resize", setBreakpointBoolean);

    return () => {
      window.removeEventListener("resize", setBreakpointBoolean);
    };
  }, [sidebarSide, isSidebarExpanded, setSidebarWidth, sidebarSize]);

  const bindResize = useDrag(
    ({ delta }) => {
      startTransition(() => {
        setSidebarSize((oldSize) => {
          const newSize =
            (oldSize as number) +
            delta[["left", "right"].includes(resizeDirection) ? 0 : 1] *
              (["right", "bottom"].includes(resizeDirection) ? 1 : -1);

          const innerMinSize =
            typeof minSize === "function" ? minSize() : minSize;

          const innerMaxSize =
            typeof maxSize === "function" ? maxSize() : maxSize;

          if (newSize < innerMinSize) {
            return innerMinSize;
          }

          if (newSize > innerMaxSize) {
            return innerMaxSize < innerMinSize ? innerMinSize : innerMaxSize;
          }

          return Math.round(newSize);
        });
      });
    },
    {
      eventOptions: { passive: false },
      preventDefault: true,
    }
  );

  return { size: sidebarSize, setSidebarSize, bindResize };
}
