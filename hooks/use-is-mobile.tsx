import { useEffect, useState } from "react";
import { useCanHover } from "@/hooks/use-can-hover";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const { canHover } = useCanHover();
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    function onChange() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }

    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return {
    isMobile: !!isMobile,
    isMobileOrNonHoverDevice: !!isMobile || !canHover,
  };
}
