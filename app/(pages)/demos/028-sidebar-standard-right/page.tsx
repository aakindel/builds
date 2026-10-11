import { type Metadata } from "next";
import { PageBackground } from "@/components/page-background";

export const metadata: Metadata = {
  title: "sidebar standard right",
};

export default function AdminDashboardPage() {
  return <PageContent />;
}

const PageContent = () => {
  return (
    <div className="relative mx-auto min-h-full w-full p-8">
      <div className="relative w-full">
        <PageBackground isScrollable />
      </div>
    </div>
  );
};
