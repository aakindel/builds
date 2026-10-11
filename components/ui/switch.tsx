"use client";

import React from "react";
import { Switch as SwitchPrimitives } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getAriaProps } from "@/utils";

const switchVariants = cva(
  cn(
    "peer inline-flex shrink-0 cursor-pointer items-center",
    "h-5 w-9",
    // border
    "rounded-full border-2 border-solid border-transparent",
    // outline
    "outline-none",
    // transition
    "transition-colors",
    // disabled
    "disabled:cursor-not-allowed disabled:opacity-50",
    // focus-visible
    "focus-visible:app-active-ring-offset"
  ),
  {
    variants: {
      variant: {
        default: "data-checked:bg-primary data-unchecked:bg-subtle",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const switchThumbVariants = cva(
  cn(
    "pointer-events-none block ring-0",
    "size-4",
    // border
    "rounded-full",
    // translate
    "data-checked:translate-x-4 data-unchecked:translate-x-0",
    // transition
    "transition-transform"
  ),
  {
    variants: {
      variant: {
        default: "bg-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitives.Root
> &
  VariantProps<typeof switchVariants> &
  VariantProps<typeof switchThumbVariants>;

const Switch = ({
  ref,
  className,
  variant,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root> &
  VariantProps<typeof switchVariants> &
  VariantProps<typeof switchThumbVariants>) => {
  const switchId = props.id ?? "switch";

  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      className={cn(switchVariants({ variant, className }))}
      ref={ref}
      {...props}
      // use getAriaProps to prevent SSR attribute mismatch hydration warning
      {...getAriaProps({
        id: switchId,
        returns: ["id"],
      })}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(switchThumbVariants({ variant }))}
      />
    </SwitchPrimitives.Root>
  );
};

const DivSwitch = ({
  ref,
  className,
  variant,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root> &
  VariantProps<typeof switchVariants> &
  VariantProps<typeof switchThumbVariants>) => {
  const switchId = props.id ?? "switch";

  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      render={
        <div>
          <SwitchPrimitives.Thumb
            data-slot="switch-thumb"
            className={cn(switchThumbVariants({ variant }))}
          />
        </div>
      }
      className={cn(switchVariants({ variant, className }))}
      ref={ref}
      {...props}
      // use getAriaProps to prevent SSR attribute mismatch hydration warning
      {...getAriaProps({
        id: switchId,
        returns: ["id"],
      })}
    />
  );
};

export { Switch, DivSwitch };
