import * as React from "react";
import { cn } from "@/utils";

const Card = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /* `plain` uses the page background (`bg-background`) instead of the elevated
     floater surface — bordered table shells that should not read as a raised card.
     `elevated` is the default bordered floater plus `shadow-sm`.
     `wash` is the default bordered card on a tertiary tint. */
  variant?: "default" | "ghost" | "plain" | "elevated" | "wash";
}) => {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl py-4",
        "has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
        // bg — floater for default/ghost/elevated; page background for plain;
        // wash is the default bordered card on a tertiary tint
        "bg-floater data-[variant=plain]:bg-background data-[variant=wash]:bg-background-tertiary/70",
        // border — default + plain + elevated + wash; ghost is borderless
        "data-[variant=default]:border-boundary dark:data-[variant=default]:border-boundary/50 data-[variant=default]:border",
        "data-[variant=plain]:border-boundary dark:data-[variant=plain]:border-boundary/50 data-[variant=plain]:border",
        cn(
          // UPDATE: shadcn-ui/lint update (new elevated and wash variants)
          "data-[variant=elevated]:border-boundary dark:data-[variant=elevated]:border-boundary/50 data-[variant=elevated]:border",
          "data-[variant=wash]:border-boundary dark:data-[variant=wash]:border-boundary/50 data-[variant=wash]:border"
        ),
        // shadow
        "data-[variant=elevated]:shadow-sm",
        // text
        "text-foreground text-sm",
        className
      )}
      {...props}
    />
  );
};

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-4",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        "[.border-b]:pb-4",
        // border
        "rounded-t-xl",
        className
      )}
      {...props}
    />
  );
};

const CardTitle = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "muted";
}) => {
  return (
    <div
      data-slot="card-title"
      data-variant={variant}
      className={cn(
        "cn-font-heading text-base leading-snug font-medium",
        "data-[variant=muted]:text-subdued",
        className
      )}
      {...props}
    />
  );
};

const CardDescription = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "muted";
}) => {
  return (
    <div
      data-slot="card-description"
      data-variant={variant}
      className={cn(
        "text-muted-foreground text-sm",
        "data-[variant=muted]:text-subdued",
        className
      )}
      {...props}
    />
  );
};

const CardAction = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
};

const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4", className)}
      {...props}
    />
  );
};

const CardFooter = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /* `plain` drops the muted band and top border so the footer sits on the
     card surface. */
  variant?: "default" | "plain";
}) => {
  return (
    <div
      data-slot="card-footer"
      data-variant={variant}
      className={cn(
        "flex items-center p-4",
        // bg
        "bg-muted/50 data-[variant=plain]:bg-transparent",
        // border
        "border-subtle rounded-b-xl border-t data-[variant=plain]:border-t-0",
        className
      )}
      {...props}
    />
  );
};

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
