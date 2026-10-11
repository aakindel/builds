import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  StandardLeftClientLayout,
  StandardLeftPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const StandardLeftLayoutShell = ({
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
          id: "left",
          side: "left",
          sidebarCookieName,
          sidebarWidthCookieName,
          minSidebarWidth: SIDEBAR_MIN_WIDTH,
          maxSidebarWidth: SIDEBAR_MAX_WIDTH,
        },
      ]}
    >
      <StandardLeftClientLayout sidebarItems={sidebarItems}>
        {children}
      </StandardLeftClientLayout>
    </SidebarProvider>
  );
};

export const StandardLeftLayout = ({
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
      <StandardLeftLayoutShell
        sidebarCookieName={sidebarCookieName}
        sidebarWidthCookieName={sidebarWidthCookieName}
        sidebarItems={sidebarItems}
      >
        <StandardLeftPageContentClientLayout className={className}>
          {children}
        </StandardLeftPageContentClientLayout>
      </StandardLeftLayoutShell>
    </React.Fragment>
  );
};
