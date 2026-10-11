import React from "react";
import { cn } from "@/utils";

const Textarea = ({
  ref,
  className,
  spellCheck = false,
  ...props
}: React.ComponentProps<"textarea">) => {
  return (
    <textarea
      name="textarea"
      autoComplete="off"
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content max-h-96 min-h-20 w-full rounded-md px-3 py-2 text-sm outline-none",
        // bg
        "bg-surface",
        // border
        "border-boundary border",
        // disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // placeholder
        "placeholder:text-subdued",
        // focus-visible
        "focus-visible:app-active-ring",
        // aria-invalid
        "app-aria-invalid-border",
        className
      )}
      ref={ref}
      spellCheck={spellCheck}
      {...props}
    />
  );
};

export { Textarea };
