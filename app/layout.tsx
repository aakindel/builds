import "@/app/styles/globals.css";

import { type Metadata } from "next";
import {
  Geist_Mono as FontMono,
  Geist as FontSans,
  Inter,
} from "next/font/google";
import { cn } from "@/utils";
import { Toaster } from "@/components/ui/toast";
import { APP_ROOT_LAYOUT_CONTAINER_ID } from "@/app/constants";
import { fontInterDots } from "@/app/fonts/inter-dots";
import { Providers } from "./providers";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const fontInter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontInter.variable,
  fontInterDots.variable
);

const getBaseUrl = () => {
  return new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`
  );
};

export const metadata: Metadata = {
  title: "Builds",
  description: "Builds",
  metadataBase: getBaseUrl(),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn("font-sans-plus", fontVariables)}
        suppressHydrationWarning
      >
        <Providers>
          <div
            id={APP_ROOT_LAYOUT_CONTAINER_ID}
            className="relative h-full w-full"
          >
            {children}
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
