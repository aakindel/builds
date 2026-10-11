import React from "react";
import { InsetDualLayout } from "./layouts/inset-dual";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <InsetDualLayout>{children}</InsetDualLayout>;
}
