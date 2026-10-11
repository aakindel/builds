"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_ROOT_LAYOUT_CONTAINER_ID } from "@/app/constants";
import { ServerNotFoundScreen } from "./server";

export function ClientNotFoundScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    document.getElementById(APP_ROOT_LAYOUT_CONTAINER_ID)?.remove();
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return isMounted
    ? createPortal(<ServerNotFoundScreen />, document.body)
    : null;
}
