import { useEffect, useState } from "react";

export function useIsKeyboardFocus() {
  const [isKeyboardFocus, setIsKeyboardFocus] = useState(false);

  /* used in event handlers to maintain isKeyboardFocus value
     (e.g. maintaining isKeyboardFocus on non-tab key presses) */
  function maintainIsKeyboardFocus() {
    if (isKeyboardFocus) {
      setTimeout(() => {
        setIsKeyboardFocus(true);
      }, 0);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        setIsKeyboardFocus(true);
      }
    }

    function onClick() {
      setIsKeyboardFocus(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return { isKeyboardFocus, maintainIsKeyboardFocus };
}
