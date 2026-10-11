"use client";

import { useAppSidebarResize } from "./use-app-sidebar-resize";

const sidebarInitialMinWidth = 200;
const sidebarInitialMaxWidth = 400;
const sidebarInitialWidth = 320;

export function useSidebarDirectionResize({
  direction,
  isSidebarExpanded,
  setSidebarWidth,
  minWidth,
  maxWidth,
  initialWidth,
}: {
  direction: "left" | "right";
  isSidebarExpanded: boolean;
  setSidebarWidth: (sidebarWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
  initialWidth?: number;
}) {
  const { size: sidebarWidth, bindResize } = useAppSidebarResize({
    sidebarSide: direction,
    initialSize: initialWidth ?? sidebarInitialWidth,
    minSize: minWidth ?? sidebarInitialMinWidth,
    maxSize: maxWidth ?? sidebarInitialMaxWidth,
    isSidebarExpanded,
    setSidebarWidth,
  });

  return {
    sidebarWidth,
    bindResize,
  };
}
