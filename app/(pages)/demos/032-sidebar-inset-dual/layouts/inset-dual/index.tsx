import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  InsetDualClientLayout,
  InsetDualPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const InsetDualLayoutShell = ({
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
      <InsetDualClientLayout
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        {children}
      </InsetDualClientLayout>
    </SidebarProvider>
  );
};

export const InsetDualLayout = ({
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
      <InsetDualLayoutShell
        sidebarItems={sidebarItems}
        sidebarRightItems={sidebarRightItems}
      >
        <InsetDualPageContentClientLayout className={className}>
          {children}
        </InsetDualPageContentClientLayout>
      </InsetDualLayoutShell>
    </React.Fragment>
  );
};
