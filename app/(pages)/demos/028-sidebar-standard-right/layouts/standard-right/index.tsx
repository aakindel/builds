import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  StandardRightClientLayout,
  StandardRightPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const StandardRightLayoutShell = ({
  children,
  sidebarCookieName,
  sidebarWidthCookieName,
  sidebarItems,
}: {
  children: React.ReactNode;
  sidebarCookieName?: string;
  sidebarWidthCookieName?: string;
  sidebarItems?: AppSidebarItemType[];
}) => {
  return (
    <SidebarProvider
      className="h-full min-h-0 overflow-hidden"
      sidebars={[
        {
          id: "right",
          side: "right",
          sidebarCookieName,
          sidebarWidthCookieName,
          minSidebarWidth: SIDEBAR_MIN_WIDTH,
          maxSidebarWidth: SIDEBAR_MAX_WIDTH,
        },
      ]}
    >
      <StandardRightClientLayout sidebarItems={sidebarItems}>
        {children}
      </StandardRightClientLayout>
    </SidebarProvider>
  );
};

export const StandardRightLayout = ({
  children,
  className,
  sidebarCookieName,
  sidebarWidthCookieName,
  sidebarItems,
}: {
  children: React.ReactNode;
  className?: string;
  sidebarCookieName?: string;
  sidebarWidthCookieName?: string;
  sidebarItems?: AppSidebarItemType[];
}) => {
  return (
    <React.Fragment>
      <PageScrollRestoration />
      <StandardRightLayoutShell
        sidebarCookieName={sidebarCookieName}
        sidebarWidthCookieName={sidebarWidthCookieName}
        sidebarItems={sidebarItems}
      >
        <StandardRightPageContentClientLayout className={className}>
          {children}
        </StandardRightPageContentClientLayout>
      </StandardRightLayoutShell>
    </React.Fragment>
  );
};
