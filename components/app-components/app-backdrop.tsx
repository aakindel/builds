"use client";

import React, { useEffect } from "react";
import { cn } from "@/utils";

const AppBackdrop = ({
  ref,
  className,
  shouldPreventInteraction = true,
  shouldPreventScroll = true,
  ...props
}: React.ComponentProps<"div"> & {
  shouldPreventInteraction?: boolean;
  shouldPreventScroll?: boolean;
}) => {
  // body[data-scroll-locked] styles defined in reset.css
  /* AppBackdrop sets data-scroll-locked on document.body
     on mount and removes it on unmount. A ref count keeps
     scroll locked if multiple backdrops are open at once. */
  useEffect(() => {
    if (!shouldPreventScroll) {
      return;
    }

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [shouldPreventScroll]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-40 bg-transparent",
        shouldPreventInteraction
          ? "pointer-events-auto"
          : "pointer-events-none",
        className
      )}
      {...props}
    />
  );
};

let scrollLockCount = 0;

function lockBodyScroll() {
  scrollLockCount += 1;

  if (scrollLockCount === 1) {
    document.body.dataset.scrollLocked = "";
  }
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);

  if (scrollLockCount === 0) {
    delete document.body.dataset.scrollLocked;
  }
}

export { AppBackdrop };
