"use client";

import React from "react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { getAriaProps } from "@/utils";

const Collapsible = ({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) => {
  return (
    // DO NOT wrap in Dynamic to prevent SSR attribute mismatch hydration warning
    // since app sidebar SSR renders & adding Dynamic messes up initial sidebar content
    <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
  );
};

const CollapsibleTrigger = ({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) => {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
};

const CollapsibleContent = ({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) => {
  const contentId = props.id ?? "collapsible-content";

  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...props}
      // use getAriaProps to prevent SSR attribute mismatch hydration warning
      {...getAriaProps({
        id: contentId,
        returns: ["id"],
      })}
    />
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
