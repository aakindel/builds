// adapted from https://nextjs.org/docs/app/api-reference/file-conventions/not-found
// using [...slug] instead of not-found because [...slug] prevents theme flash

import { NotFoundScreen } from "@/components/not-found-screen";

export const metadata = {
  title: "404: This page could not be found.",
  description: "404: This page could not be found.",
};

export default function NotFound() {
  return <NotFoundScreen />;
}
