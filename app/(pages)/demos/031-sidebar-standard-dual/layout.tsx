import React from "react";
import { StandardDualLayout } from "./layouts/standard-dual";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <StandardDualLayout>{children}</StandardDualLayout>;
}
