import { type Metadata } from "next";
import { PageBackground } from "@/components/page-background";

export const metadata: Metadata = {
  title: "sidebar standard left",
};

export default function AdminDashboardPage() {
  return <PageContent />;
}

const PageContent = () => {
  return (
    <div className="relative mx-auto min-h-full w-full p-8">
      {/* <div className="pointer-events-none fixed top-7.75 left-0 z-50 h-px w-full bg-red-500/50" /> */}
      <div className="relative w-full">
        <PageBackground isScrollable />
      </div>
    </div>
  );
};
