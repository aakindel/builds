import React from "react";
import { cn } from "@/utils";
import { ConditionalRender } from "./conditional-render";

export const PageBackground = ({
  className,
  isScrollable,
  scrollHeight = 1500,
}: {
  className?: string;
  isScrollable?: boolean;
  scrollHeight?: number;
}) => {
  return (
    <React.Fragment>
      <div
        className={cn(
          // "bg-green-200/70"
          // "absolute inset-0 px-4 pt-32 pb-52"
          "absolute inset-0 z-10",
          className
        )}
        style={isScrollable ? { height: `${scrollHeight}px` } : {}}
      >
        <div
          className={cn(
            "bg-background h-full w-full",
            "bg-[linear-gradient(135deg,var(--background)_0,var(--background)_5px,var(--subtle)_5px,var(--subtle)_6px,var(--background)_6px,var(--background)_16px,var(--subtle)_16px,var(--subtle)_17px,var(--background)_17px,var(--background)_22px)]",
            "bg-size-[15.556px_15.556px]"
          )}
        />
        {/* from https://shadcnstudio.com/blocks/dashboard-and-application/application-shell */}
        {/* <div className="h-full rounded-md border bg-[repeating-linear-gradient(45deg,var
          (--muted),var(--muted)_1px,var(--card)_2px,var(--card)_15px)]" /> */}
        {/* dash pattern below has inconsistent thickness: https://stackoverflow.com/a/68345823 */}
        {/* <div className="h-full w-full border border-dashed bg-[repeating-linear-gradient(135deg,
          var(--subtle),var(--subtle)_1px,var(--background)_1px,var(--background)_10px)]" /> */}
      </div>
      <ConditionalRender condition={!!isScrollable}>
        <div
          className="bg-secondary z-0 flex w-40"
          style={{ height: `${scrollHeight}px` }}
        ></div>
      </ConditionalRender>
    </React.Fragment>
  );
};
