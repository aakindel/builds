import React from "react";
import { type Metadata } from "next";
import {
  PageScrollContainer,
  PageScrollRestoration,
} from "@/components/page-scroll";
import { SignupForm } from "./components/form";

export const metadata: Metadata = {
  title: "signup marketing checkbox",
};

export default function MarketingCheckboxPage() {
  return (
    <React.Fragment>
      <PageScrollRestoration />
      <PageScrollContainer className="h-full min-h-0 w-full overflow-y-auto">
        <div className="bg-background flex min-h-full w-full items-center justify-center px-4 py-12">
          <SignupForm />
        </div>
      </PageScrollContainer>
    </React.Fragment>
  );
}
