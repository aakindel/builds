"use client";

import React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";
import { XIconButton } from "@/components/ui/button";
import { AppBackdrop } from "@/components/app-components";

const Sheet = ({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) => {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
};

const SheetTrigger = ({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) => {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
};

const SheetClose = ({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) => {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
};

const SheetPortal = ({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) => {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
};

const SheetOverlay = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) => {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      render={<AppBackdrop />}
      className={cn(
        "fixed inset-0 z-50",
        // bg
        "bg-overlay",

        /* Base UI data-starting/ending-style are for CSS transitions, not tw-animate
           keyframes. Using animate-in/out can finish before unmount is detected and
           briefly flash the overlay back to full opacity on close. */
        // DO NOT USE BELOW
        // "data-starting-style:animate-in data-starting-style:fade-in-0",
        // "data-ending-style:animate-out data-ending-style:fade-out-0",

        "transition-opacity duration-300 ease-in-out",
        /* Skip enter opacity so the overlay appears immediately; only fade out
           on exit via data-ending-style (duration-0 on starting-style does not
           work because the 300ms transition runs after that attribute is removed). */
        // DO NOT USE BELOW
        // "data-starting-style:opacity-0 data-starting-style:duration-0",
        "data-ending-style:opacity-0",
        // Keep the overlay hidden after close until unmount (prevents end-of-exit flash).
        "data-closed:opacity-0",
        className
      )}
      ref={ref}
      {...props}
    />
  );
};

const sheetVariants = cva(
  cn(
    "fixed z-50 gap-4 p-6 shadow-lg",
    // bg
    "bg-background",
    // transition
    "transition ease-in-out",
    // data-starting-style
    "data-starting-style:animate-in data-starting-style:duration-500",
    // data-ending-style
    "data-ending-style:animate-out data-ending-style:duration-300"
  ),
  {
    variants: {
      side: {
        top: cn(
          "inset-x-0 top-0",
          // border
          "border-b",
          // data-starting-style
          "data-starting-style:slide-in-from-top",
          // data-ending-style
          "data-ending-style:slide-out-to-top"
        ),
        bottom: cn(
          "inset-x-0 bottom-0",
          // border
          "border-t",
          // data-starting-style
          "data-starting-style:slide-in-from-bottom",
          // data-ending-style
          "data-ending-style:slide-out-to-bottom"
        ),
        left: cn(
          "inset-y-0 left-0 h-full w-3/4",
          // border
          "border-r",
          // data-starting-style
          "data-starting-style:slide-in-from-left",
          // data-ending-style
          "data-ending-style:slide-out-to-left",
          // sm
          "sm:max-w-sm"
        ),
        right: cn(
          "inset-y-0 right-0 h-full w-3/4",
          // border
          "border-l",
          // data-starting-style
          "data-starting-style:slide-in-from-right",
          // data-ending-style
          "data-ending-style:slide-out-to-right",
          // sm
          "sm:max-w-sm"
        ),
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface SheetContentProps
  extends
    React.ComponentProps<typeof SheetPrimitive.Popup>,
    VariantProps<typeof sheetVariants> {
  showCloseButton?: boolean;
}

const SheetContent = ({
  ref,
  side = "right",
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetContentProps) => {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        ref={ref}
        data-slot="sheet-content"
        data-side={side}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <XIconButton className="absolute top-4 right-4 rounded-sm" />
            }
          />
        ) : null}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
};

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2",
      // text
      "text-center",
      // sm
      "sm:text-left",
      className
    )}
    {...props}
  />
);

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse",
      // sm
      "sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);

const SheetTitle = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) => {
  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn(
        // text
        "text-primary text-lg font-semibold",
        className
      )}
      {...props}
    />
  );
};

const SheetDescription = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) => {
  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn(
        // text
        "text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  );
};

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
