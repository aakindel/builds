import React from "react";
import { type Metadata } from "next";
import {
  PageScrollContainer,
  PageScrollRestoration,
} from "@/components/page-scroll";
import { SignupForm } from "./components/form";

export const metadata: Metadata = {
  title: "signup split",
};

export default function SignupSplitPage() {
  return (
    <React.Fragment>
      <PageScrollRestoration />
      <PageScrollContainer className="h-full min-h-0 w-full overflow-y-auto">
        <div className="bg-background grid min-h-full w-full lg:grid-cols-2">
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <SignupForm />
          </div>
          <div className="bg-muted relative hidden lg:block">
            <picture>
              <img
                src="/image-placeholder.svg"
                alt=""
                className="absolute inset-0 size-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </picture>
          </div>
        </div>
      </PageScrollContainer>
    </React.Fragment>
  );
}
