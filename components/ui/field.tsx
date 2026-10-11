"use client";

import React, { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ConditionalRender } from "@/components/conditional-render";

const FieldSet = ({
  className,
  ...props
}: React.ComponentProps<"fieldset">) => {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-2 has-[>[data-slot=radio-group]]:gap-2",
        className
      )}
      {...props}
    />
  );
};

const FieldLegend = ({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) => {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3",
        // text
        "font-medium",
        // data-[variant=legend]
        "data-[variant=legend]:text-base",
        // data-[variant=label]
        "data-[variant=label]:text-sm data-[variant=label]:leading-snug",
        className
      )}
      {...props}
    />
  );
};

const FieldGroup = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-2.5 *:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  );
};
const fieldVariants = cva(
  [
    "group/field flex w-full gap-2.5",
    // text
    "data-[invalid=true]:text-destructive",
  ],
  {
    variants: {
      orientation: {
        vertical: ["flex-col *:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "*:data-[slot=field-label]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto [&>.sr-only]:w-auto",
          "@md/field-group:*:data-[slot=field-label]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        gridResponsive: [
          "grid grid-cols-1 flex-col @md/field-group:grid @md/field-group:grid-cols-2 @md/field-group:items-center",
          "@md/field-group:*:data-[slot=field-label]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

const Field = ({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) => {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
};

const FieldContent = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-1 leading-snug peer-data-[slot=checkbox]:gap-0.5",
        className
      )}
      {...props}
    />
  );
};

const FieldLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof Label>) => {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2",
        // text
        "leading-snug",
        // bg
        "has-data-checked:bg-major/4 dark:has-data-checked:bg-surface",
        // border
        "has-data-checked:border-subdued/60 dark:has-data-checked:border-dim/80 has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border",
        // disabled
        "group-data-[disabled=true]/field:opacity-50",
        // has-[>[data-slot=field]]
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col *:data-[slot=field]:p-4",
        className
      )}
      {...props}
    />
  );
};

const FieldTitle = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2",
        // text
        "text-sm leading-snug font-medium",
        // disabled
        "group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  );
};

const FieldDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        // text
        "text-muted-foreground text-sm leading-normal font-normal group-has-data-[orientation=horizontal]/field:text-balance",
        // [&>a]
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
};

const FieldSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) => {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5",
        // text
        "text-sm",
        // data-[variant=outline]
        "group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      <ConditionalRender condition={Boolean(children)}>
        <span
          className={cn(
            "relative mx-auto block w-fit px-2",
            // bg — page surface by default; match a floater card when nested
            "bg-background group-data-[variant=default]/card:bg-floater group-data-[variant=ghost]/card:bg-floater group-data-[variant=elevated]/card:bg-floater",
            // text
            "text-muted-foreground"
          )}
          data-slot="field-separator-content"
        >
          {children}
        </span>
      </ConditionalRender>
    </div>
  );
};

const FieldError = ({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors) {
      return null;
    }

    if (errors?.length === 1 && errors[0]?.message) {
      return errors[0].message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map((error, index) =>
          error?.message ? <li key={index}>{error.message}</li> : null
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-destructive text-sm font-normal", className)}
      {...props}
    >
      {content}
    </div>
  );
};

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
