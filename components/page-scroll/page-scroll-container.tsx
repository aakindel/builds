"use client";

import React from "react";
import {
  PAGE_SCROLL_CONTAINER_ATTRIBUTE,
  PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE,
} from "./page-scroll";
import { usePageScroll } from "./use-page-scroll";

export const PageScrollContainer = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const scrollRef = usePageScroll<HTMLDivElement>();

  return (
    <div
      ref={scrollRef}
      {...{
        [PAGE_SCROLL_CONTAINER_ATTRIBUTE]: "",
        [PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE]: "",
      }}
      className={`psck ${className}`}
    >
      {children}
    </div>
  );
};
