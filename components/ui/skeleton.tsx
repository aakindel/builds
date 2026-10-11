import React from "react";
import { cn } from "@/utils";

const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn("bg-secondary animate-pulse rounded-md", className)}
      {...props}
    />
  );
};

const StaticSkeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn("bg-secondary rounded-md", className)} {...props} />
  );
};

export { Skeleton, StaticSkeleton };
