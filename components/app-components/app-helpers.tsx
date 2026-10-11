import React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, preventEventDefault } from "@/utils";
import { buttonVariants } from "@/components/ui/button/button-variants";

const AppHorizontalLine = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      className={cn(
        "pointer-events-none fixed top-1/2 left-0 z-9999 h-px w-full bg-red-500/50",
        className
      )}
      style={style}
    />
  );
};

const AppVerticalLine = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-y-0 left-1/2 z-9999 w-px bg-red-500/50",
        className
      )}
      style={style}
    />
  );
};

const appLinkVariants = cva(buttonVariants({ variant: "link" }), {
  variants: {
    variant: {
      default: "",
      muted: "data-[tone=muted]:text-muted-foreground",
      caption: "data-[tone=caption]:hover:text-muted-foreground",
    },
    size: {
      default: "",
      xs: "data-[size=xs]:text-xs",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const AppLink = ({
  className,
  href,
  onClick,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Link> &
  VariantProps<typeof appLinkVariants>) => {
  return (
    <Link
      {...props}
      href={href}
      data-variant="link"
      data-tone={variant}
      data-size={size}
      className={cn(appLinkVariants({ variant, size }), className)}
      onClick={(event) => {
        if (href === "#") {
          preventEventDefault(event);
        }
        onClick?.(event);
      }}
    />
  );
};

export { AppHorizontalLine, AppLink, AppVerticalLine };
