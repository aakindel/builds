import React from "react";
import { StandardLeftLayout } from "./layouts/standard-left";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <StandardLeftLayout>{children}</StandardLeftLayout>;
}
