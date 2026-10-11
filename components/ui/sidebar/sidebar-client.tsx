"use client";

import React, {
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, VariantProps } from "class-variance-authority";
import { MenuIcon, PanelLeft, PanelRight, XIcon } from "lucide-react";
import {
  cn,
  getAriaProps,
  getTrueOrUndefined,
  getVisibilityHiddenClass,
  isMac,
  setAppCookie,
} from "@/utils";
import { useCanHover } from "@/hooks/use-can-hover";
import { useIsKeyboardFocus } from "@/hooks/use-is-keyboard-focus";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Button, TooltipIconButton, XIconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  APP_VARIABLE_CLASS,
  APP_VARIABLE_CLASSES,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_HEIGHT_CLASS,
  SIDEBAR_LAYOUT_TOPBAR_MT_CLASS,
  SIDEBAR_ROW_LEADING_CLASS,
  SIDEBAR_TEXT_START_CLASS,
} from "@/components/alignment";
import { ConditionalRender } from "@/components/conditional-render";
import { Icons } from "@/components/icons";
import { DEFAULT_SIDEBAR_WIDTH } from "@/app/constants";
import {
  SidebarResizeHandle,
  type SidebarResizeHandleVariant,
} from "./sidebar-resize-handle";

// don't export cookie names from here, since client component
// export const SIDEBAR_COOKIE_NAME = "sidebar_state";
// export const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width_state";
// const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
// const DEFAULT_SIDEBAR_WIDTH = "16rem";
// export const DEFAULT_SIDEBAR_OPEN = true;
// export const DEFAULT_SIDEBAR_WIDTH = 256; // 16rem
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_LEFT_SHORTCUT = "b";
const SIDEBAR_KEYBOARD_RIGHT_SHORTCUT = "i";
const SIDEBAR_RESIZE_MIN_WIDTH = 200;
const SIDEBAR_RESIZE_MAX_WIDTH = 400;

type SidebarSide = "left" | "right";

type SidebarState = "expanded" | "collapsed";

type SidebarStateSetter<T> = (value: T | ((previousValue: T) => T)) => void;

export type SidebarClientConfig = {
  id: string;
  side?: SidebarSide;
  defaultIsExpanded?: boolean;
  isExpanded?: boolean;
  onIsExpandedChange?: (isExpanded: boolean) => void;
  defaultSidebarWidth?: number;
  sidebarWidth?: number;
  onSidebarWidthChange?: (sidebarWidth: number) => void;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  sidebarCookieName?: string;
  sidebarWidthCookieName?: string;
  keyboardShortcut?: string;
};

type SidebarEntryContextProps = {
  id: string;
  side: SidebarSide;
  state: "expanded" | "collapsed";
  isExpanded: boolean;
  setIsExpanded: SidebarStateSetter<boolean>;
  isExpandedMobile: boolean;
  setIsExpandedMobile: SidebarStateSetter<boolean>;
  isMobile: boolean;
  isMobileOrNonHoverDevice: boolean;
  sidebarWidth: number;
  setSidebarWidth: SidebarStateSetter<number>;
  keyboardShortcut?: string;
  toggleSidebar: () => void;
};

type SidebarContextProps = {
  isMobile: boolean;
  isMobileOrNonHoverDevice: boolean;
  defaultSidebarId: string;
  sidebarIds: string[];
  sidebarsById: Record<string, SidebarEntryContextProps>;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

const SidebarIdentityContext = React.createContext<{
  id?: string;
  side: SidebarSide;
}>({ side: "left" });

function useSidebarContext() {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarClientProvider.");
  }

  return context;
}

function useSidebar() {
  const context = useSidebarContext();

  return getSidebarFromContext(context);
}

function getSidebarFromContext(
  context: SidebarContextProps,
  {
    sidebarId,
    side,
  }: {
    sidebarId?: string;
    side?: SidebarSide;
  } = {}
) {
  if (sidebarId && context.sidebarsById[sidebarId]) {
    return context.sidebarsById[sidebarId];
  }

  const matchingSidebarId = context.sidebarIds.find(
    (id) => context.sidebarsById[id]?.side === side
  );
  const resolvedSidebarId =
    matchingSidebarId ?? context.defaultSidebarId ?? context.sidebarIds[0];
  const sidebar = context.sidebarsById[resolvedSidebarId];

  if (!sidebar) {
    throw new Error("No sidebar is registered in SidebarClientProvider.");
  }

  return sidebar;
}

function useSidebarBySide(side: SidebarSide = "left", sidebarId?: string) {
  const context = useSidebarContext();

  return getSidebarFromContext(context, { sidebarId, side });
}

function useSidebarById(sidebarId: string) {
  const context = useSidebarContext();

  return getSidebarFromContext(context, { sidebarId });
}

export type SidebarClientProviderProps = {
  sidebars?: SidebarClientConfig[];
};

const SidebarProviderContainer = ({
  ref,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <TooltipProvider delay={0}>
      <div
        style={
          {
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full",
          APP_VARIABLE_CLASS.sidebar(
            "ui-sidebar-layout-topbar-icon-button-size",
            "$sidebar-layout-topbar-default"
          ),
          APP_VARIABLE_CLASS.sidebar(
            "ui-sidebar-layout-topbar-padding",
            "$sidebar-layout-topbar-default"
          ),
          APP_VARIABLE_CLASSES.sidebar(
            [
              "ui-sidebar-layout-inset-gap",
              "ui-sidebar-layout-inset-border-width",
              "ui-sidebar-layout-inset-radius",
            ],
            "$sidebar-layout-inset-default"
          ),
          /* defines [--ui-sidebar-layout-topbar-mt] */
          SIDEBAR_LAYOUT_TOPBAR_MT_CLASS,
          /* defines [--ui-sidebar-layout-topbar-button-radius] */
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_CLASS,
          /* defines [--ui-sidebar-layout-topbar-height] */
          SIDEBAR_LAYOUT_TOPBAR_HEIGHT_CLASS,
          // has-data-[variant=inset]
          "has-data-[variant=inset]:bg-background-tertiary",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </TooltipProvider>
  );
};

function clampSidebarWidth(
  width: number,
  {
    minSidebarWidth = SIDEBAR_RESIZE_MIN_WIDTH,
    maxSidebarWidth = SIDEBAR_RESIZE_MAX_WIDTH,
  }: {
    minSidebarWidth?: number;
    maxSidebarWidth?: number;
  } = {}
) {
  return Math.min(
    maxSidebarWidth,
    Math.max(minSidebarWidth, Math.round(width))
  );
}

function getDefaultKeyboardShortcut(side: SidebarSide) {
  return side === "right"
    ? SIDEBAR_KEYBOARD_RIGHT_SHORTCUT
    : SIDEBAR_KEYBOARD_LEFT_SHORTCUT;
}

function formatSidebarKeyboardShortcutLabel(keyboardShortcut: string): string {
  const modifierKey = isMac() ? "⌘" : "Ctrl";

  return `${
    modifierKey === "Ctrl" ? `${modifierKey}-` : modifierKey
  }${keyboardShortcut.toUpperCase()}`;
}

function getSidebarCollapseTriggerTooltipContent({
  label,
  keyboardShortcut,
  isKeyboardShortcutInline = true,
}: {
  label: string;
  keyboardShortcut?: string;
  isKeyboardShortcutInline?: boolean;
}) {
  if (!keyboardShortcut || keyboardShortcut.length === 0) {
    return label;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        isKeyboardShortcutInline &&
          "flex-row items-center justify-center gap-1.5"
      )}
    >
      <p>{label}</p>
      <p className="text-muted-foreground text-xs" suppressHydrationWarning>
        {formatSidebarKeyboardShortcutLabel(keyboardShortcut)}
      </p>
    </div>
  );
}

function getInitialStateMap<T>({
  sidebars,
  getValue,
}: {
  sidebars: SidebarClientConfig[];
  getValue: (sidebar: SidebarClientConfig) => T;
}) {
  return sidebars.reduce<Record<string, T>>((stateMap, sidebar) => {
    return {
      ...stateMap,
      [sidebar.id]: getValue(sidebar),
    };
  }, {});
}

function getSidebarConfigs(sidebars?: SidebarClientConfig[]) {
  const sidebarConfigs = sidebars?.length
    ? sidebars
    : ([{ id: "left", side: "left" }] satisfies SidebarClientConfig[]);
  const usedKeyboardShortcuts = new Set<string>();

  return sidebarConfigs.map((sidebar) => {
    const side = sidebar.side ?? "left";
    const defaultKeyboardShortcut = getDefaultKeyboardShortcut(side);
    const keyboardShortcut =
      sidebar.keyboardShortcut ??
      (usedKeyboardShortcuts.has(defaultKeyboardShortcut)
        ? undefined
        : defaultKeyboardShortcut);

    if (keyboardShortcut) {
      usedKeyboardShortcuts.add(keyboardShortcut);
    }

    return {
      ...sidebar,
      side,
      defaultIsExpanded: sidebar.defaultIsExpanded ?? true,
      defaultSidebarWidth: sidebar.defaultSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
      keyboardShortcut,
    };
  });
}

const SidebarClientProvider = ({
  ref,
  className,
  style,
  children,
  sidebars,
  ...props
}: React.ComponentProps<"div"> & SidebarClientProviderProps) => {
  const { isMobile, isMobileOrNonHoverDevice } = useIsMobile();
  const sidebarConfigs = useMemo(() => getSidebarConfigs(sidebars), [sidebars]);

  const [expandedStateById, setExpandedStateById] = useState(() =>
    getInitialStateMap({
      sidebars: sidebarConfigs,
      getValue: (sidebar) => sidebar.defaultIsExpanded ?? true,
    })
  );
  const [expandedMobileStateById, setExpandedMobileStateById] = useState(() =>
    getInitialStateMap({
      sidebars: sidebarConfigs,
      getValue: () => false,
    })
  );
  const [sidebarWidthById, setSidebarWidthById] = useState(() =>
    getInitialStateMap({
      sidebars: sidebarConfigs,
      getValue: (sidebar) =>
        sidebar.defaultSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
    })
  );

  useEffect(() => {
    setExpandedStateById((stateMap) => ({
      ...getInitialStateMap({
        sidebars: sidebarConfigs,
        getValue: (sidebar) => sidebar.defaultIsExpanded ?? true,
      }),
      ...stateMap,
    }));
    setExpandedMobileStateById((stateMap) => ({
      ...getInitialStateMap({
        sidebars: sidebarConfigs,
        getValue: () => false,
      }),
      ...stateMap,
    }));
    setSidebarWidthById((stateMap) => ({
      ...getInitialStateMap({
        sidebars: sidebarConfigs,
        getValue: (sidebar) =>
          sidebar.defaultSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
      }),
      ...stateMap,
    }));
  }, [sidebarConfigs]);

  const setSidebarIsExpanded = useCallback(
    (
      sidebar: SidebarClientConfig,
      value: boolean | ((value: boolean) => boolean)
    ) => {
      const currentValue =
        sidebar.isExpanded ??
        expandedStateById[sidebar.id] ??
        sidebar.defaultIsExpanded ??
        true;
      const nextValue =
        typeof value === "function" ? value(currentValue) : value;

      if (sidebar.onIsExpandedChange) {
        sidebar.onIsExpandedChange(nextValue);
      } else {
        setExpandedStateById((stateMap) => ({
          ...stateMap,
          [sidebar.id]: nextValue,
        }));
      }

      setAppCookie({
        cookieName: sidebar.sidebarCookieName,
        cookieValue: nextValue,
      });
    },
    [expandedStateById]
  );

  const setSidebarIsExpandedMobile = useCallback(
    (
      sidebar: SidebarClientConfig,
      value: boolean | ((value: boolean) => boolean)
    ) => {
      const currentValue = expandedMobileStateById[sidebar.id] ?? false;
      const nextValue =
        typeof value === "function" ? value(currentValue) : value;

      setExpandedMobileStateById((stateMap) => ({
        ...stateMap,
        [sidebar.id]: nextValue,
      }));
    },
    [expandedMobileStateById]
  );

  const setSidebarWidthValue = useCallback(
    (
      sidebar: SidebarClientConfig,
      value: number | ((value: number) => number)
    ) => {
      const currentValue =
        sidebar.sidebarWidth ??
        sidebarWidthById[sidebar.id] ??
        sidebar.defaultSidebarWidth ??
        DEFAULT_SIDEBAR_WIDTH;
      const nextValue = clampSidebarWidth(
        typeof value === "function" ? value(currentValue) : value,
        {
          minSidebarWidth: sidebar.minSidebarWidth,
          maxSidebarWidth: sidebar.maxSidebarWidth,
        }
      );

      if (sidebar.onSidebarWidthChange) {
        sidebar.onSidebarWidthChange(nextValue);
      } else {
        startTransition(() => {
          setSidebarWidthById((stateMap) => ({
            ...stateMap,
            [sidebar.id]: nextValue,
          }));
        });
      }

      setAppCookie({
        cookieName: sidebar.sidebarWidthCookieName,
        cookieValue: nextValue,
      });
    },
    [sidebarWidthById]
  );

  const contextValue = useMemo<SidebarContextProps>(() => {
    const sidebarsById = sidebarConfigs.reduce<
      Record<string, SidebarEntryContextProps>
    >((sidebarMap, sidebar) => {
      const side = sidebar.side ?? "left";
      const isExpanded =
        sidebar.isExpanded ??
        expandedStateById[sidebar.id] ??
        sidebar.defaultIsExpanded ??
        true;
      const sidebarWidthValue =
        sidebar.sidebarWidth ??
        sidebarWidthById[sidebar.id] ??
        sidebar.defaultSidebarWidth ??
        DEFAULT_SIDEBAR_WIDTH;
      const isExpandedMobile = expandedMobileStateById[sidebar.id] ?? false;
      const state = (
        isExpanded ? "expanded" : "collapsed"
      ) satisfies SidebarState;

      return {
        ...sidebarMap,
        [sidebar.id]: {
          id: sidebar.id,
          side,
          state,
          isExpanded,
          setIsExpanded: (value) => setSidebarIsExpanded(sidebar, value),
          isExpandedMobile,
          setIsExpandedMobile: (value) =>
            setSidebarIsExpandedMobile(sidebar, value),
          isMobile,
          isMobileOrNonHoverDevice,
          sidebarWidth: sidebarWidthValue,
          setSidebarWidth: (value) => setSidebarWidthValue(sidebar, value),
          keyboardShortcut: sidebar.keyboardShortcut,
          toggleSidebar: () => {
            if (isMobile) {
              setSidebarIsExpandedMobile(sidebar, (expanded) => !expanded);
              return;
            }

            setSidebarIsExpanded(sidebar, (expanded) => !expanded);
          },
        },
      };
    }, {});

    return {
      isMobile,
      isMobileOrNonHoverDevice,
      defaultSidebarId: sidebarConfigs[0]?.id ?? "left",
      sidebarIds: sidebarConfigs.map((sidebar) => sidebar.id),
      sidebarsById,
    };
  }, [
    expandedMobileStateById,
    expandedStateById,
    isMobile,
    isMobileOrNonHoverDevice,
    setSidebarIsExpanded,
    setSidebarIsExpandedMobile,
    setSidebarWidthValue,
    sidebarConfigs,
    sidebarWidthById,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      const sidebar = sidebarConfigs.find(
        (sidebarConfig) =>
          Boolean(sidebarConfig.keyboardShortcut) &&
          event.key === sidebarConfig.keyboardShortcut
      );

      if (!sidebar) {
        return;
      }

      event.preventDefault();
      contextValue.sidebarsById[sidebar.id]?.toggleSidebar();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextValue.sidebarsById, sidebarConfigs]);

  const defaultSidebar =
    contextValue.sidebarsById[contextValue.defaultSidebarId] ??
    contextValue.sidebarsById[contextValue.sidebarIds[0]];

  return (
    <SidebarContext.Provider value={contextValue}>
      <SidebarProviderContainer
        ref={ref}
        className={className}
        style={
          {
            "--sidebar-width": `${defaultSidebar?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH}px`,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </SidebarProviderContainer>
    </SidebarContext.Provider>
  );
};

const SIDEBAR_ALIGNMENT_CLASS_NAME = cn(
  APP_VARIABLE_CLASSES.sidebar(
    [
      "ui-sidebar-prefix-container-size",
      "ui-sidebar-prefix-gap",
      "ui-sidebar-header-prefix-icon-size",
      "ui-sidebar-menu-prefix-icon-size",
    ],
    "$sidebar-prefix-default"
  ),
  APP_VARIABLE_CLASSES.sidebar(
    ["ui-sidebar-px", "ui-sidebar-row-px"],
    "$sidebar-padding-default"
  ),
  /* defines [--ui-sidebar-row-leading] */
  SIDEBAR_ROW_LEADING_CLASS,
  /* defines [--ui-sidebar-text-start] */
  SIDEBAR_TEXT_START_CLASS
);

const Sidebar = ({
  ref,
  side = "left",
  sidebarId,
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  resizeHandleOffset = 0,
  isSidebarResizable = true,
  resizeHandleVariant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  side?: SidebarSide;
  sidebarId?: string;
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  resizeHandleOffset?: number;
  isSidebarResizable?: boolean;
  resizeHandleVariant?: SidebarResizeHandleVariant;
}) => {
  const {
    isMobile,
    isMobileOrNonHoverDevice,
    state,
    isExpandedMobile,
    setIsExpandedMobile,
    isExpanded,
    sidebarWidth,
    setSidebarWidth,
  } = useSidebarBySide(side, sidebarId);

  const wrapWithSideContext = (content: React.ReactNode) => (
    <SidebarIdentityContext.Provider value={{ id: sidebarId, side }}>
      {content}
    </SidebarIdentityContext.Provider>
  );

  if (collapsible === "none") {
    const { style: styleProp, ...restProps } = props;

    return wrapWithSideContext(
      <div
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            ...styleProp,
          } as React.CSSProperties
        }
        className={cn(
          SIDEBAR_ALIGNMENT_CLASS_NAME,
          "flex h-full w-(--sidebar-width) flex-col",
          // bg
          "bg-background-tertiary",
          // text
          "text-primary",
          className
        )}
        ref={ref}
        {...restProps}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return wrapWithSideContext(
      <Sheet
        open={isExpandedMobile}
        onOpenChange={setIsExpandedMobile}
        {...props}
      >
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className={cn(
            SIDEBAR_ALIGNMENT_CLASS_NAME,
            "w-(--sidebar-width) p-0",
            // bg
            "bg-background-tertiary",
            // text
            "text-primary",
            // [&>button]
            "[&>button]:hidden",
            className
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return wrapWithSideContext(
    <React.Fragment>
      <div
        ref={ref}
        className={cn(
          "group peer hidden",
          // text
          "text-primary",
          // md
          "md:block"
        )}
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
        style={
          {
            // needed for setting sidebar width in dom
            "--sidebar-width": `${sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "relative w-(--sidebar-width)",
            // bg
            "bg-transparent",
            // transition
            // "transition-[width] duration-200 ease-linear",
            "animate-none duration-0",
            // group-data-[collapsible=offcanvas]
            "group-data-[collapsible=offcanvas]:w-0",
            // data-[side]
            "group-data-[side=right]:rotate-180",
            // group-data-[collapsible=icon]
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
          )}
        />
        <div
          className={cn(
            SIDEBAR_ALIGNMENT_CLASS_NAME,
            "fixed inset-y-0 z-20 hidden h-svh w-(--sidebar-width)",
            // transition
            // "transition-[left,right,width] duration-200 ease-linear",
            "animate-none duration-0",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:-left-(--sidebar-width)"
              : "right-0 group-data-[collapsible=offcanvas]:-right-(--sidebar-width)",
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
            // Only the default variant draws a divider: floating and inset are
            // separated from the page by their own card edge.
            variant === "sidebar" &&
              "group-data-[side=left]:border-r group-data-[side=right]:border-l",
            // md
            "md:flex",
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className={cn(
              "flex flex-col",
              // Floating insets its card with margins rather than rail padding,
              // so the rail keeps its natural --sidebar-width. The rail is a
              // flex container, so stretch subtracts the margins on both axes.
              variant === "floating"
                ? "m-(--ui-sidebar-layout-inset-gap) flex-1"
                : "h-full w-full",
              // bg
              "bg-background-tertiary",
              // group-data-[variant=floating] border
              "group-data-[variant=floating]:border-subtle group-data-[variant=floating]:rounded-(--ui-sidebar-layout-inset-radius) group-data-[variant=floating]:border-(length:--ui-sidebar-layout-inset-border-width)",
              // group-data-[variant=floating]
              "group-data-[variant=floating]:shadow",
              getVisibilityHiddenClass(state === "collapsed")
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <ConditionalRender condition={isSidebarResizable}>
        <SidebarResizeHandle
          sidebarId={sidebarId}
          sidebarSide={side}
          sidebarWidth={sidebarWidth}
          isSidebarExpanded={isExpanded}
          isMobileOrNonHoverDevice={isMobileOrNonHoverDevice}
          onSidebarWidthChange={setSidebarWidth}
          offset={resizeHandleOffset}
          isFloating={variant === "floating"}
          variant={resizeHandleVariant}
          insetDirection={variant === "inset" ? side : undefined}
        />
      </ConditionalRender>
    </React.Fragment>
  );
};

const SidebarTrigger = ({
  ref,
  className,
  onClick,
  sidebarId,
  sidebarSide = "left",
  ...props
}: React.ComponentProps<typeof Button> & {
  sidebarId?: string;
  sidebarSide?: SidebarSide;
}) => {
  const { toggleSidebar } = useSidebarBySide(sidebarSide, sidebarId);

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="muted"
      size="icon-xs"
      className={cn(
        "shrink-0",
        SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
        /* defines [--ui-button-radius] from topbar-button-radius */
        SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {sidebarSide === "left" ? <PanelLeft /> : <PanelRight />}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};

const SidebarCollapseTrigger = ({
  className,
  sidebarSide = "left",
  sidebarId,
  sidebarName,
  tooltipText: tooltipTextProp,
  isKeyboardShortcutInline = true,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & {
  sidebarSide?: SidebarSide;
  sidebarId?: string;
  sidebarName?: string;
  tooltipText?: string | React.ReactNode;
  isKeyboardShortcutInline?: boolean;
}) => {
  const {
    isExpanded,
    isExpandedMobile,
    isMobile,
    keyboardShortcut,
    toggleSidebar,
  } = useSidebarBySide(sidebarSide, sidebarId);
  const { isKeyboardFocus } = useIsKeyboardFocus();
  const { canHover } = useCanHover();
  const tooltipLabel =
    tooltipTextProp ??
    (sidebarName
      ? `${isExpanded && !isMobile ? "Collapse" : "Expand"} ${sidebarName} Sidebar`
      : `${isExpanded && !isMobile ? "Collapse" : "Expand"} Sidebar`);
  const tooltipText =
    typeof tooltipLabel === "string"
      ? getSidebarCollapseTriggerTooltipContent({
          label: tooltipLabel,
          keyboardShortcut: isMobile ? undefined : keyboardShortcut,
          isKeyboardShortcutInline,
        })
      : tooltipLabel;
  const tooltipAriaLabel =
    typeof tooltipLabel === "string" ? tooltipLabel : undefined;
  const collapseTriggerId = sidebarId
    ? `sidebar-collapse-trigger-${sidebarId}`
    : `sidebar-collapse-trigger-${sidebarSide}`;

  return (
    <div
      className={cn(
        "z-40 flex shrink-0 gap-1",
        // text
        "text-muted-foreground"
      )}
    >
      <TooltipIconButton
        ariaLabel={tooltipAriaLabel}
        shouldHideContent={isExpandedMobile}
        triggerId={collapseTriggerId}
        size="icon-xs"
        className={cn(
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
          "shrink-0",
          "opacity-0",
          "transition-opacity duration-150",
          "text-muted-foreground",
          "hover:text-primary focus-visible:text-primary focus-visible:duration-0",
          "hover:bg-secondary",
          "group-hover:opacity-100 focus-visible:opacity-100",
          isKeyboardFocus && "group-focus-within:opacity-100",
          !canHover && "opacity-100",
          isExpandedMobile && "opacity-100",
          className
        )}
        icon={
          isMobile ? (
            <XIcon className="text-muted-foreground size-4" />
          ) : sidebarSide === "left" ? (
            <Icons.chevronsLeft />
          ) : (
            <Icons.chevronsRight />
          )
        }
        tooltipText={tooltipText}
        side={sidebarSide === "left" ? "right" : "left"}
        onClick={() => {
          toggleSidebar();
        }}
        {...props}
      />
    </div>
  );
};

const SidebarMenuCollapseTrigger = ({
  className,
  sidebarSide = "left",
  sidebarId,
  sidebarName,
  tooltipText: tooltipTextProp,
  isKeyboardShortcutInline = true,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & {
  sidebarSide?: SidebarSide;
  sidebarId?: string;
  sidebarName?: string;
  tooltipText?: string | React.ReactNode;
  isKeyboardShortcutInline?: boolean;
}) => {
  const {
    isExpanded,
    isExpandedMobile,
    isMobile,
    keyboardShortcut,
    toggleSidebar,
  } = useSidebarBySide(sidebarSide, sidebarId);
  const { canHover } = useCanHover();
  const tooltipLabel =
    tooltipTextProp ??
    (sidebarName
      ? `${isExpanded && !isMobile ? "Collapse" : "Expand"} ${sidebarName} Sidebar`
      : `${isExpanded && !isMobile ? "Collapse" : "Expand"} Sidebar`);
  const tooltipText =
    typeof tooltipLabel === "string"
      ? getSidebarCollapseTriggerTooltipContent({
          label: tooltipLabel,
          keyboardShortcut: isMobile ? undefined : keyboardShortcut,
          isKeyboardShortcutInline,
        })
      : tooltipLabel;
  const tooltipAriaLabel =
    typeof tooltipLabel === "string" ? tooltipLabel : undefined;
  const menuCollapseTriggerId = sidebarId
    ? `sidebar-menu-collapse-trigger-${sidebarId}`
    : `sidebar-menu-collapse-trigger-${sidebarSide}`;

  return (
    <div
      className={cn(
        "z-40 flex shrink-0 gap-1",
        // text
        "text-muted-foreground"
      )}
    >
      <TooltipIconButton
        ariaLabel={tooltipAriaLabel}
        shouldHideContent={isExpandedMobile}
        triggerId={menuCollapseTriggerId}
        size="icon-xs"
        className={cn(
          "group/sidebar-tmc-btn",
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_SIZE_MAP_CLASS,
          SIDEBAR_LAYOUT_TOPBAR_BUTTON_RADIUS_MAP_CLASS,
          className
        )}
        icon={
          <React.Fragment>
            <MenuIcon
              className={cn(
                "h-4.25 w-4.25 shrink-0",
                !isMobile && canHover && "group-hover/sidebar-tmc-btn:hidden"
              )}
            />
            <ConditionalRender condition={!isMobile && canHover}>
              {sidebarSide === "left" ? (
                isExpanded ? (
                  <Icons.chevronsLeft className="hidden group-hover/sidebar-tmc-btn:flex" />
                ) : (
                  <Icons.chevronsRight className="hidden group-hover/sidebar-tmc-btn:flex" />
                )
              ) : isExpanded ? (
                <Icons.chevronsRight className="hidden group-hover/sidebar-tmc-btn:flex" />
              ) : (
                <Icons.chevronsLeft className="hidden group-hover/sidebar-tmc-btn:flex" />
              )}
            </ConditionalRender>
          </React.Fragment>
        }
        tooltipText={tooltipText}
        side={sidebarSide === "left" ? "right" : "left"}
        onClick={() => {
          toggleSidebar();
        }}
        {...props}
      />
    </div>
  );
};

const SidebarCloseButton = ({
  ref,
  className,
  onClick,
  sidebarSide: sidebarSideProp,
  sidebarId: sidebarIdProp,
  ...props
}: React.ComponentProps<typeof XIconButton> & {
  sidebarSide?: SidebarSide;
  sidebarId?: string;
}) => {
  const sidebarIdentityFromContext = use(SidebarIdentityContext);
  const sidebarSide = sidebarSideProp ?? sidebarIdentityFromContext.side;
  const sidebarId = sidebarIdProp ?? sidebarIdentityFromContext.id;
  const { toggleSidebar } = useSidebarBySide(sidebarSide, sidebarId);

  return (
    <XIconButton
      ref={ref}
      ariaLabel="Close Sidebar"
      size="icon-xs"
      className={cn(className)}
      onClick={(event) => {
        if (onClick) {
          onClick?.(event);
        } else {
          toggleSidebar();
        }
      }}
      {...props}
    />
  );
};

const SidebarInset = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"main">) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex w-full flex-1 flex-col",
        "overflow-hidden", // prevents table from overflowing page
        // bg
        "bg-background",
        // Left sidebar is a previous sibling — peer-* can see it.
        // md:peer-data-[variant=inset] border
        "md:peer-data-[variant=inset]:border-boundary md:peer-data-[variant=inset]:rounded-(--ui-sidebar-layout-inset-radius) md:peer-data-[variant=inset]:border-(length:--ui-sidebar-layout-inset-border-width)",
        // md:peer-data-[variant=inset]
        "md:peer-data-[variant=inset]:mt-(--ui-sidebar-layout-inset-gap) md:peer-data-[variant=inset]:mr-(--ui-sidebar-layout-inset-gap) md:peer-data-[variant=inset]:mb-(--ui-sidebar-layout-inset-gap) md:peer-data-[variant=inset]:shadow",
        // Right sidebar is the next sibling — peer-* cannot see it.
        // :has(+ [data-variant=inset]) matches that following inset rail.
        "md:has-[+[data-variant=inset]]:border-boundary md:has-[+[data-variant=inset]]:rounded-(--ui-sidebar-layout-inset-radius) md:has-[+[data-variant=inset]]:border-(length:--ui-sidebar-layout-inset-border-width)",
        "md:has-[+[data-variant=inset]]:mt-(--ui-sidebar-layout-inset-gap) md:has-[+[data-variant=inset]]:mb-(--ui-sidebar-layout-inset-gap) md:has-[+[data-variant=inset]]:ml-(--ui-sidebar-layout-inset-gap) md:has-[+[data-variant=inset]]:shadow",
        /* Horizontal gap keys off data-collapsible=offcanvas, not data-state.
           data-state is open vs closed (always set). data-collapsible names the
           collapsed mode and is "" while expanded. Offcanvas collapsed is w-0,
           so restore the viewport gap; expanded and icon-collapsed still have
           width, so stay flush. Offcanvas-only demos look the same either way
           because collapsed offcanvas sets both attributes together. Icon
           collapse would not: data-state=collapsed would put a gap next to the
           48px icon rail. data-state=expanded is the wrong inverse for the same
           reason — a collapsed icon rail is not expanded, but it is still a rail. */
        "md:peer-not-data-[collapsible=offcanvas]:peer-data-[variant=inset]:ml-0 md:peer-data-[collapsible=offcanvas]:peer-data-[variant=inset]:ml-(--ui-sidebar-layout-inset-gap)",
        "md:has-[+[data-collapsible=offcanvas][data-variant=inset]]:mr-(--ui-sidebar-layout-inset-gap) md:has-[+[data-variant=inset]:not([data-collapsible=offcanvas])]:mr-0",
        className
      )}
      {...props}
    />
  );
};

const SidebarInput = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof Input>) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full shadow-none",
        // bg
        "bg-background",
        // focus-visible
        "focus-visible:ring-subdued focus-visible:ring-2",
        className
      )}
      {...props}
    />
  );
};

const SidebarHeader = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn(
        "flex flex-col justify-center gap-2",
        "px-(--ui-sidebar-px)",
        "py-(--ui-sidebar-layout-topbar-padding)",
        "min-h-(--ui-sidebar-layout-topbar-height)",
        // can add SIDEBAR_LAYOUT_TOPBAR_DIVIDER_CLASS here if a "border" is needed
        "group-data-[variant=inset]:mt-(--ui-sidebar-layout-topbar-mt)",
        className
      )}
      {...props}
    />
  );
};

const SidebarFooter = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};

const SidebarSeparator = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof Separator>) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn(
        "mx-2 w-auto",
        // bg
        "bg-boundary",
        className
      )}
      {...props}
    />
  );
};

const SidebarContent = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
        "overscroll-none px-(--ui-sidebar-px) py-2",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  );
};

const SidebarGroup = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
};

const SidebarGroupLabel = ({
  ref,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) => {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ref,
      "data-sidebar": "group-label",
      className: cn(
        "flex h-8 shrink-0 items-center px-2",
        // border
        "rounded-md",
        // text
        "text-primary/70 text-xs font-medium",
        // outline
        "outline-none",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        // [&>svg]
        "[&>svg]:size-4 [&>svg]:shrink-0",
        // transition
        "transition-[margin,opacity] duration-200 ease-linear",
        // ring
        "ring-subdued focus-visible:ring-2",
        className
      ),
      ...props,
    },
  });
};

const SidebarGroupAction = ({
  ref,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button">) => {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      ref,
      "data-sidebar": "group-action",
      className: cn(
        "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center p-0",
        // bg
        "hover:bg-secondary",
        // border
        "rounded-md",
        // text
        "text-primary hover:text-primary",
        // outline
        "outline-none",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:hidden",
        // [&>svg]
        "[&>svg]:size-4 [&>svg]:shrink-0",
        // transition
        "transition-transform",
        // ring
        "ring-subdued focus-visible:ring-2",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        className
      ),
      ...props,
    },
  });
};

const SidebarGroupContent = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
};

const SidebarMenu = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"ul">) => {
  return (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
};

const SidebarMenuItem = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"li">) => {
  return (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
};
const sidebarMenuButtonVariants = cva(
  cn(
    "peer/menu-button flex w-full items-center gap-(--ui-sidebar-prefix-gap) overflow-hidden px-(--ui-sidebar-row-px) py-2 text-left outline-none group-has-data-[sidebar=menu-action]/menu-item:pr-8",
    // bg
    "hover:bg-secondary active:bg-secondary data-[active=true]:bg-secondary data-popup-open:hover:bg-secondary",
    // border
    "rounded-md",
    // text
    "hover:text-primary active:text-primary data-[active=true]:text-primary data-popup-open:hover:text-primary text-sm font-medium",
    // group-data-[collapsible=icon]
    "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
    // [&>span]
    "[&>span:last-child]:truncate",
    // [&>svg]
    "[&>svg]:size-4 [&>svg]:shrink-0",
    // transition
    "transition-[width,height,padding]",
    // disabled
    "disabled:pointer-events-none disabled:opacity-50",
    // aria-disabled
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    // focus-visible
    "focus-visible:app-active-ring",
    "h-8"
  ),
  {
    variants: {
      variant: {
        default: cn(
          // bg
          "hover:bg-secondary",
          // text
          "text-muted-foreground hover:text-primary"
        ),
        outline: cn(
          // bg
          "bg-background hover:bg-secondary",
          // text
          "hover:text-primary",
          // shadow
          "shadow-[0_0_0_1px_hsl(var(--boundary))] hover:shadow-[0_0_0_1px_hsl(var(--secondary))]"
        ),
        // UPDATE: shadcn-ui/lint update (section variant is new)
        section: cn(
          "group/collapsible-trigger",
          // text — section labels stay subdued, including hover
          "text-subdued hover:text-muted-foreground active:text-muted-foreground data-panel-open:hover:text-muted-foreground",
          "h-8 min-h-8 justify-start gap-1 text-xs font-medium [&>svg]:size-3"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const SidebarMenuButton = ({
  ref,
  render,
  isActive = false,
  variant = "default",
  tooltip,
  className,
  prefix,
  suffix,
  children,
  ...props
}: Omit<useRender.ComponentProps<"button">, "prefix"> & {
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
} & VariantProps<typeof sidebarMenuButtonVariants>) => {
  const sidebarIdentity = use(SidebarIdentityContext);
  const { isMobile, state } = useSidebarBySide(
    sidebarIdentity.side,
    sidebarIdentity.id
  );

  const buttonId =
    props.id && !props.id?.startsWith("radix-")
      ? props.id
      : "sidebar-menu-button";

  const button = useRender({
    defaultTagName: "button",
    render,
    props: {
      ref,
      "data-sidebar": "menu-button",
      "data-active": isActive,
      "data-prefix": getTrueOrUndefined(prefix !== undefined),
      "data-suffix": getTrueOrUndefined(suffix !== undefined),
      className: cn(sidebarMenuButtonVariants({ variant }), className),
      ...props,
      // use getAriaProps to prevent SSR attribute mismatch hydration warning
      ...getAriaProps({
        id: buttonId,
        returns: ["id", "ariaControls"],
      }),
      children: (
        <React.Fragment>
          <ConditionalRender condition={prefix !== undefined}>
            <div
              data-prefix-container
              className="flex w-(--ui-sidebar-prefix-container-size) items-center justify-center [&_svg]:size-(--ui-sidebar-menu-prefix-icon-size)"
            >
              {prefix}
            </div>
          </ConditionalRender>
          {children}
          <ConditionalRender condition={suffix !== undefined}>
            <div
              data-suffix-container
              className="flex items-center justify-center"
            >
              {suffix}
            </div>
          </ConditionalRender>
        </React.Fragment>
      ),
    },
  });

  if (!tooltip) {
    return button;
  }

  let tooltipProps = tooltip;
  if (typeof tooltipProps === "string") {
    tooltipProps = {
      children: tooltipProps,
    };
  }

  const tooltipTriggerId = `${buttonId}-tooltip`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={button ?? undefined}
        // use getAriaProps to prevent SSR attribute mismatch hydration warning
        {...getAriaProps({
          id: tooltipTriggerId,
          returns: ["id"],
        })}
      />
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
};

const SidebarMenuAction = ({
  ref,
  className,
  render,
  shouldShowOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> & {
  shouldShowOnHover?: boolean;
}) => {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      ref,
      "data-sidebar": "menu-action",
      className: cn(
        "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0",
        // bg
        "hover:bg-secondary",
        // text
        "text-primary hover:text-primary",
        // peer-hover
        "peer-hover/menu-button:text-primary",
        // outline
        "outline-none",
        // [&>svg]
        "[&>svg]:size-4 [&>svg]:shrink-0",
        // transition
        "transition-transform",
        // ring
        "ring-subdued focus-visible:ring-2",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:hidden",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        shouldShowOnHover &&
          cn(
            // opacity
            "data-popup-open:opacity-100 md:opacity-0",
            // peer-data-[active]
            "peer-data-[active=true]/menu-button:text-primary",
            // group-hover
            "group-hover/menu-item:opacity-100",
            // group-focus-within
            "group-focus-within/menu-item:opacity-100"
          ),
        className
      ),
      ...props,
    },
  });
};

const SidebarMenuBadge = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 tabular-nums select-none",
        // border
        "rounded-md",
        // text
        "text-primary text-xs font-medium",
        // peer-hover
        "peer-hover/menu-button:text-primary",
        // peer-data-[active]
        "peer-data-[active=true]/menu-button:text-primary",
        "top-1.5",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
};

const SIDEBAR_SKELETON_WIDTH = "70%";

const SidebarMenuSkeleton = ({
  ref,
  className,
  shouldShowIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  shouldShowIcon?: boolean;
}) => {
  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      <ConditionalRender condition={shouldShowIcon}>
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      </ConditionalRender>
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": SIDEBAR_SKELETON_WIDTH,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

const SidebarMenuSub = ({
  ref,
  className,
  ...props
}: React.ComponentProps<"ul">) => {
  return (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 flex-col gap-1 px-2.5 py-0.5",
        // border
        "border-boundary border-l",
        // translate
        "translate-x-px",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
};

const SidebarMenuSubItem = ({ ref, ...props }: React.ComponentProps<"li">) => {
  return <li ref={ref} {...props} />;
};

const SidebarMenuSubButton = ({
  ref,
  render,
  isActive,
  className,
  ...props
}: useRender.ComponentProps<"a"> & {
  isActive?: boolean;
}) => {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      ref,
      "data-sidebar": "menu-sub-button",
      "data-active": isActive,
      className: cn(
        "flex h-7 min-w-0 items-center gap-2 overflow-hidden px-2",
        // bg
        "hover:bg-secondary active:bg-secondary",
        // border
        "rounded-md",
        // text
        "text-primary hover:text-primary active:text-primary text-sm",
        // data-[active]
        "data-[active=true]:bg-secondary data-[active=true]:text-primary",
        // group-data-[collapsible=icon]
        "group-data-[collapsible=icon]:hidden",
        // [&>span]
        "[&>span:last-child]:truncate",
        // [&>svg]
        "[&>svg]:text-primary [&>svg]:size-4 [&>svg]:shrink-0",
        // translate
        "-translate-x-px",
        // outline
        "outline-none",
        // disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // aria-disabled
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        // ring
        "ring-subdued focus-visible:ring-2",
        className
      ),
      ...props,
    },
  });
};

export {
  Sidebar,
  SidebarClientProvider,
  SidebarCloseButton,
  SidebarCollapseTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuCollapseTrigger,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebarById,
  useSidebarBySide,
  useSidebar,
};
