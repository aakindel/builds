import React from "react";
import { FloatingDualLayout } from "./layouts/floating-dual";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <FloatingDualLayout>{children}</FloatingDualLayout>;
}
