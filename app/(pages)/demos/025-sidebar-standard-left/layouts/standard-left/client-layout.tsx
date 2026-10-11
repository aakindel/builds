"use client";

import React from "react";
import { type AppSidebarItemType } from "@/types";
import { cn } from "@/utils";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_DIVIDER_CLASS,
} from "@/components/alignment";
import { PageScrollContainer } from "@/components/page-scroll";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "./sidebar";

export const StandardLeftPageContentClientLayout = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
        className
      )}
    >
      <PageTopbar />
      <PageScrollContainer className="relative min-h-0 flex-1 overflow-y-auto">
        {children}
      </PageScrollContainer>
    </div>
  );
};

export const StandardLeftClientLayout = ({
  children,
  sidebarItems,
}: {
  children: React.ReactNode;
  sidebarItems?: AppSidebarItemType[];
}) => {
  return (
    <React.Fragment>
      <AppSidebar sidebarItems={sidebarItems} />
      <SidebarInset className="min-h-0">{children}</SidebarInset>
    </React.Fragment>
  );
};

const PageTopbar = () => {
  return (
    <header
      className={cn(
        "bg-background flex shrink-0 items-center justify-between",
        "p-(--ui-sidebar-layout-topbar-padding)",
        "min-h-(--ui-sidebar-layout-topbar-height)",
        SIDEBAR_LAYOUT_TOPBAR_DIVIDER_CLASS
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <SidebarTrigger />
      </div>
      <ThemeToggle
        className={cn(
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
          /* defines [--ui-button-radius] from topbar-button-radius */
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS
        )}
      />
    </header>
  );
};
