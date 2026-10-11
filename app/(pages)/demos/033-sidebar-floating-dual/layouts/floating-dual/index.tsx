import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  FloatingDualClientLayout,
  FloatingDualPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const FloatingDualLayoutShell = ({
  children,
  sidebarItems,
  sidebarRightItems,
}: {
  children: React.ReactNode;
  sidebarItems?: AppSidebarItemType[];
  sidebarRightItems?: AppSidebarItemType[];
}) => {
  return (
    <SidebarProvider
      className="h-full min-h-0 overflow-hidden"
      sidebars={[
        {
          id: "left",
          side: "left",
          minSidebarWidth: SIDEBAR_MIN_WIDTH,
          maxSidebarWidth: SIDEBAR_MAX_WIDTH,
        },
        {
          id: "right",
          side: "right",
          minSidebarWidth: SIDEBAR_MIN_WIDTH,
          maxSidebarWidth: SIDEBAR_MAX_WIDTH,
        },
      ]}
    >
      <FloatingDualClientLayout
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        {children}
      </FloatingDualClientLayout>
    </SidebarProvider>
  );
};

export const FloatingDualLayout = ({
  children,
  className,
  sidebarItems,
  sidebarRightItems,
}: {
  children: React.ReactNode;
  className?: string;
  sidebarItems?: AppSidebarItemType[];
  sidebarRightItems?: AppSidebarItemType[];
}) => {
  return (
    <React.Fragment>
      <PageScrollRestoration />
      <FloatingDualLayoutShell
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        <FloatingDualPageContentClientLayout className={className}>
          {children}
        </FloatingDualPageContentClientLayout>
      </FloatingDualLayoutShell>
    </React.Fragment>
  );
};
