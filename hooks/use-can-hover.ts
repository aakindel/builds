import { useEffect, useState } from "react";

export function useCanHover() {
  const [canHover, setCanHover] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover)");

    function update() {
      setCanHover(mediaQuery.matches);
    }

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return { canHover: !!canHover };
}
