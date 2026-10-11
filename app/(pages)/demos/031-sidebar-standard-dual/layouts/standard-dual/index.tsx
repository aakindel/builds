import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  StandardDualClientLayout,
  StandardDualPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const StandardDualLayoutShell = ({
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
      <StandardDualClientLayout
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        {children}
      </StandardDualClientLayout>
    </SidebarProvider>
  );
};

export const StandardDualLayout = ({
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
      <StandardDualLayoutShell
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        <StandardDualPageContentClientLayout className={className}>
          {children}
        </StandardDualPageContentClientLayout>
      </StandardDualLayoutShell>
    </React.Fragment>
  );
};
