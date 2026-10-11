import React from "react";
import { FloatingRightLayout } from "./layouts/floating-right";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <FloatingRightLayout>{children}</FloatingRightLayout>;
}
