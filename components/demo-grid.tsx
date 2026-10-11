import React from "react";
import Link from "next/link";
import { type DemoPageItemType } from "@/types";
import { cn, getStringWithoutFrontslash, getTitleCase } from "@/utils";
import {
  APP_VARIABLE_CLASSES,
  DEMO_GRID_RADIUS_CLASS,
} from "@/components/alignment";
import { ConditionalRender } from "@/components/conditional-render";
import { DemoGridImage } from "@/components/demo-grid-image";
import { Icons } from "@/components/icons";

export const DemoGrid = ({ demoPages }: { demoPages: DemoPageItemType[] }) => {
  return (
    <div className="min-h-full w-full px-6 py-12 md:px-12">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {demoPages.map((page) => {
          return (
            <DemoItem
              key={page.href}
              title={page.title}
              slug={page.slug}
              href={page.href}
              hasScreenshot={page.hasScreenshot}
            >
              <DemoGridImage
                screenshotPath={`/${getStringWithoutFrontslash(page.href)}`}
              >
                <picture>
                  <img
                    src={`/${getStringWithoutFrontslash(page.href)}-light-mini.webp`}
                    alt={page.title}
                    loading="eager"
                    className="absolute inset-0 size-full object-cover object-top dark:hidden"
                  />
                </picture>
                <picture>
                  <img
                    src={`/${getStringWithoutFrontslash(page.href)}-dark-mini.webp`}
                    alt={page.title}
                    loading="eager"
                    className="absolute inset-0 hidden size-full object-cover object-top dark:block"
                  />
                </picture>
              </DemoGridImage>
            </DemoItem>
          );
        })}
      </div>
    </div>
  );
};

const DemoItem = ({
  title,
  slug,
  href = "#",
  hasScreenshot,
  children,
}: {
  title: string;
  slug: string;
  href?: string;
  hasScreenshot?: boolean;
  children?: React.ReactNode;
}) => {
  const titleCaseTitle = getTitleCase(title);

  return (
    <div
      className={cn(
        APP_VARIABLE_CLASSES.demoGrid(
          ["ui-demo-grid-preview-radius", "ui-demo-grid-p"],
          "$demo-grid-default"
        ),
        DEMO_GRID_RADIUS_CLASS,
        "group/basic-demo-page has-[[data-slot=demo-link]:focus-visible]:app-active-ring-offset relative -m-(--ui-demo-grid-p) rounded-(--ui-demo-grid-radius) p-(--ui-demo-grid-p) hover:bg-neutral-100/70 dark:hover:bg-neutral-900/70"
      )}
    >
      <DemoItemPreview title={titleCaseTitle} hasScreenshot={hasScreenshot}>
        {children}
      </DemoItemPreview>
      <div className="mt-4 flex items-center justify-between gap-1.5">
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="demo-link"
          className="min-w-0 flex-1 after:absolute after:inset-0 after:z-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        >
          <DemoItemTitle title={titleCaseTitle} />
        </Link>
        <Link
          href={`https://github.com/aakindel/builds/tree/main/app/(pages)/demos/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${titleCaseTitle} on GitHub`}
          className="hit-area-2.5 text-subdued relative z-2 inline-flex size-6 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/basic-demo-page:opacity-100 group-has-focus-visible/basic-demo-page:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Icons.github className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};

const DemoItemPreview = ({
  title,
  hasScreenshot,
  children,
}: {
  title: string;
  hasScreenshot?: boolean;
  children?: React.ReactNode;
}) => {
  return (
    <div className="bg-background-tertiary border-subtle text-eminent relative z-1 aspect-600/360 overflow-hidden rounded-(--ui-demo-grid-preview-radius) ring-1">
      <div className="relative flex h-full w-full items-center justify-center">
        <ConditionalRender condition={Boolean(hasScreenshot)}>
          {children}
        </ConditionalRender>
        <ConditionalRender condition={!hasScreenshot}>
          <span className="z-10 max-w-[80%] truncate">{title}</span>
        </ConditionalRender>
      </div>
    </div>
  );
};

const DemoItemTitle = ({ title }: { title: string }) => {
  return (
    <p className="text-primary relative z-1 truncate text-sm font-medium">
      {title}
    </p>
  );
};
