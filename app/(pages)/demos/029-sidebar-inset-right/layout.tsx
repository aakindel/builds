import React from "react";
import { InsetRightLayout } from "./layouts/inset-right";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <InsetRightLayout>{children}</InsetRightLayout>;
}
