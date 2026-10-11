import React from "react";
import { type AppSidebarItemType } from "@/types";
import { SidebarProvider } from "@/components/ui/sidebar/sidebar-provider";
import { PageScrollRestoration } from "@/components/page-scroll";
import {
  InsetRightClientLayout,
  InsetRightPageContentClientLayout,
} from "./client-layout";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 330;

const InsetRightLayoutShell = ({
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
      <InsetRightClientLayout sidebarItems={sidebarItems}>
        {children}
      </InsetRightClientLayout>
    </SidebarProvider>
  );
};

export const InsetRightLayout = ({
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
      <InsetRightLayoutShell
        sidebarCookieName={sidebarCookieName}
        sidebarWidthCookieName={sidebarWidthCookieName}
        sidebarItems={sidebarItems}
      >
        <InsetRightPageContentClientLayout className={className}>
          {children}
        </InsetRightPageContentClientLayout>
      </InsetRightLayoutShell>
    </React.Fragment>
  );
};
