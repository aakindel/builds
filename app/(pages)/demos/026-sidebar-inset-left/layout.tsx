import React from "react";
import { InsetLeftLayout } from "./layouts/inset-left";

export default function AdminDashboardPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <InsetLeftLayout>{children}</InsetLeftLayout>;
}
