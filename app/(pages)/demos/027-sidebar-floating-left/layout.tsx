import React from "react";
import { FloatingLeftLayout } from "./layouts/floating-left";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <FloatingLeftLayout>{children}</FloatingLeftLayout>;
}
