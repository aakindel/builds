"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, ChevronRight, CommandIcon } from "lucide-react";
import { type AppSidebarItemType } from "@/types";
import { cn } from "@/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarCloseButton,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ConditionalRender } from "@/components/conditional-render";
import { AppLucideIcon } from "@/components/icons";

export function AppSidebar({
  sidebarItems,
  className,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sidebarItems?: AppSidebarItemType[];
}) {
  return (
    <Sidebar resizeHandleVariant="highlight" {...props} className={className}>
      <AppSidebarHeader headerItems={defaultSidebarHeaderItems} />
      <SidebarContent>
        <NavMain items={sidebarItems ?? defaultSidebarItems} />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

const AppSidebarHeader = ({
  headerItems,
}: {
  headerItems: { logo: React.ReactNode; title: string };
}) => {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="group/item z-10 flex min-h-(--ui-sidebar-layout-topbar-icon-button-size) items-center justify-between text-sm">
            <div
              className={cn(
                "pointer-events-none z-10 flex w-full items-center justify-start",
                "px-(--ui-sidebar-row-px)"
              )}
            >
              <span className="text-eminent cursor-default truncate text-sm leading-(--ui-sidebar-row-leading) font-semibold">
                {headerItems.title}
              </span>
            </div>
            <SidebarCloseButton />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
};

function isSidebarNavActive(pathname: string, href: string) {
  if (href === "#" || !href.startsWith("/")) {
    return false;
  }
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

function isSidebarItemOrChildActive(
  pathname: string,
  item: AppSidebarItemType
): boolean {
  const itemUrl = item.url ?? "#";
  if (item.isActive ?? isSidebarNavActive(pathname, itemUrl)) {
    return true;
  }
  return (
    item.items?.some((child) => isSidebarItemOrChildActive(pathname, child)) ??
    false
  );
}

const NavMainItemIcon = ({
  icon,
  className,
}: {
  icon: AppSidebarItemType["icon"];
  className: string;
}) => {
  if (typeof icon === "string") {
    return <AppLucideIcon icon={icon} className={className} />;
  }
  const IconComponent = icon;
  return <IconComponent className={className} />;
};

const NavMainSubItems = ({
  subItems,
  pathname,
}: {
  subItems: AppSidebarItemType[];
  pathname: string;
}) => {
  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {subItems.map((subItem) => {
          const subUrl = subItem.url ?? "#";
          const isSubActive =
            subItem.isActive ?? isSidebarNavActive(pathname, subUrl);
          const shouldOpenInNewTab =
            !!subItem.shouldOpenInNewTab && !isSubActive;

          return (
            <SidebarMenuItem key={subItem.title}>
              <SidebarMenuButton
                isActive={isSubActive}
                prefix={
                  <NavMainItemIcon
                    icon={subItem.icon}
                    className="text-muted-foreground"
                  />
                }
                render={
                  <Link
                    href={subUrl}
                    className="flex items-center"
                    rel={shouldOpenInNewTab ? "noopener noreferrer" : undefined}
                    target={shouldOpenInNewTab ? "_blank" : undefined}
                  />
                }
              >
                <span>{subItem.title}</span>
                <ConditionalRender condition={shouldOpenInNewTab}>
                  <ArrowUpRightIcon className="text-muted-foreground/50 size-4" />
                </ConditionalRender>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );
};

const collapsiblePbClassName = {
  block: "pb-2",
  openState: "data-open:pb-2",
} as const;

export function NavMain({ items }: { items: AppSidebarItemType[] }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      {items.map((item) => {
        if (item.items?.length) {
          if (item.title === "General") {
            return (
              <SidebarGroup
                key={item.title}
                className={cn("gap-1 p-0", collapsiblePbClassName.block)}
              >
                <NavMainSubItems subItems={item.items} pathname={pathname} />
              </SidebarGroup>
            );
          }

          return (
            <Collapsible
              key={item.title}
              defaultOpen={
                isSidebarItemOrChildActive(pathname, item) ||
                !item.isDefaultCollapsed
              }
              className="group/collapsible"
            >
              <SidebarGroup className="gap-1 p-0">
                <CollapsibleTrigger
                  render={
                    <SidebarMenuButton
                      type="button"
                      variant="section"
                      /* chevronRight is not suffix since it appears right after
                         the text and not at the end of the sidebar menu button */
                    />
                  }
                >
                  <span className="truncate">{item.title}</span>
                  <ChevronRight
                    className={cn(
                      // "shrink-0 transition-[opacity,transform] duration-150",
                      "opacity-0 group-hover/collapsible-trigger:opacity-100 group-focus-visible/collapsible-trigger:opacity-100",
                      "group-data-panel-open/collapsible-trigger:rotate-90"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={collapsiblePbClassName.openState}
                >
                  <NavMainSubItems subItems={item.items} pathname={pathname} />
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        }

        const itemUrl = item.url ?? "#";
        const isActive = item.isActive ?? isSidebarNavActive(pathname, itemUrl);

        return (
          <SidebarMenu key={item.title}>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive}
                prefix={
                  <NavMainItemIcon
                    icon={item.icon}
                    className="text-muted-foreground"
                  />
                }
                render={
                  <Link
                    href={itemUrl}
                    rel={
                      item.shouldOpenInNewTab
                        ? "noopener noreferrer"
                        : undefined
                    }
                    target={item.shouldOpenInNewTab ? "_blank" : undefined}
                  />
                }
              >
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        );
      })}
    </div>
  );
}

const DefaultAppSidebarLogo = () => {
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex aspect-square items-center justify-center rounded-xs",
        "size-(--ui-sidebar-prefix-container-size)",
        "mr-(--ui-sidebar-prefix-gap)"
      )}
    >
      <CommandIcon className="size-(--ui-sidebar-header-prefix-icon-size)" />
    </div>
  );
};

const defaultSidebarHeaderItems = {
  logo: <DefaultAppSidebarLogo />,
  title: "Right Sidebar",
};

const defaultSidebarItems: AppSidebarItemType[] = [
  {
    title: "General",
    icon: "x",
    items: [
      {
        title: "Search",
        url: "#",
        icon: "search",
      },
      {
        title: "Home",
        url: "#",
        icon: "home",
      },
      {
        title: "Templates",
        url: "#",
        icon: "blocks",
      },
      {
        title: "Trash",
        url: "#",
        icon: "trash-2",
      },
    ],
  },
];
