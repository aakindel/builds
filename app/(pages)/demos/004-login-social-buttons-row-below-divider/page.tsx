import React from "react";
import { type Metadata } from "next";
import {
  PageScrollContainer,
  PageScrollRestoration,
} from "@/components/page-scroll";
import { LoginForm } from "./components/form";

export const metadata: Metadata = {
  title: "login social buttons row below divider",
};

export default function SocialButtonsRowBelowDividerPage() {
  return (
    <React.Fragment>
      <PageScrollRestoration />
      <PageScrollContainer className="h-full min-h-0 w-full overflow-y-auto">
        <div className="bg-background flex min-h-full w-full items-center justify-center px-4 py-12">
          <LoginForm />
        </div>
      </PageScrollContainer>
    </React.Fragment>
  );
}
