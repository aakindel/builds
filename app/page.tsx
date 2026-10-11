import React from "react";
import { type Metadata } from "next";
import { DemoGrid } from "@/components/demo-grid";
import { FixedMainNav } from "@/components/main-nav";
import {
  PageScrollContainer,
  PageScrollRestoration,
} from "@/components/page-scroll";
import { DEMO_PAGES } from "./(pages)/demos";

export const metadata: Metadata = {
  title: "Builds",
};

export default function BuildsHome() {
  return (
    <React.Fragment>
      <FixedMainNav />
      <PageScrollRestoration />
      <PageScrollContainer className="h-full min-h-0 w-full overflow-y-auto">
        <DemoGrid demoPages={DEMO_PAGES} />
      </PageScrollContainer>
    </React.Fragment>
  );
}
