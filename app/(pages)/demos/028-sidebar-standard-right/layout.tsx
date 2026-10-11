import React from "react";
import { StandardRightLayout } from "./layouts/standard-right";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <StandardRightLayout>{children}</StandardRightLayout>;
}
