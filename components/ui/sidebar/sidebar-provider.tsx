import React from "react";
import { getAppCookie } from "@/utils/server";
import { DEFAULT_SIDEBAR_OPEN, DEFAULT_SIDEBAR_WIDTH } from "@/app/constants";
import {
  SidebarClientProvider,
  type SidebarClientConfig,
  type SidebarClientProviderProps,
} from "./sidebar-client";

type SidebarProviderProps = React.ComponentProps<"div"> &
  SidebarClientProviderProps;

const SidebarProvider = async ({
  ref,
  children,
  ...props
}: SidebarProviderProps) => {
  const defaultSidebars: SidebarClientConfig[] = [{ id: "left", side: "left" }];

  async function getDefaultIsExpanded({
    cookieName,
    defaultIsExpanded,
  }: {
    cookieName?: string;
    defaultIsExpanded?: boolean;
  }) {
    return await getAppCookie<boolean>({
      cookieName,
      defaultValue: defaultIsExpanded ?? DEFAULT_SIDEBAR_OPEN,
    });
  }

  async function getDefaultSidebarWidth({
    cookieName,
    defaultSidebarWidth,
  }: {
    cookieName?: string;
    defaultSidebarWidth?: number;
  }) {
    return await getAppCookie<number>({
      cookieName,
      defaultValue: defaultSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
    });
  }

  const sidebars = await Promise.all(
    (props.sidebars ?? defaultSidebars).map(async (sidebar) => {
      const defaultIsExpanded = await getDefaultIsExpanded({
        cookieName: sidebar.sidebarCookieName,
        defaultIsExpanded: sidebar.defaultIsExpanded,
      });
      const defaultSidebarWidth = await getDefaultSidebarWidth({
        cookieName: sidebar.sidebarWidthCookieName,
        defaultSidebarWidth: sidebar.defaultSidebarWidth,
      });

      return {
        ...sidebar,
        defaultIsExpanded,
        defaultSidebarWidth,
      };
    })
  );

  return (
    <SidebarClientProvider ref={ref} {...props} sidebars={sidebars}>
      {children}
    </SidebarClientProvider>
  );
};

export { SidebarProvider };
