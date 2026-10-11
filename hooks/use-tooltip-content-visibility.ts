import { useEffect } from "react";
import { useIsKeyboardFocus } from "./use-is-keyboard-focus";

export function useTooltipContentVisibility({
  tooltipTriggerRef,
}: {
  tooltipTriggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { isKeyboardFocus } = useIsKeyboardFocus();

  function onBlur() {
    // runs when user switches away from the tab (i.e., tab is hidden)
    if (tooltipTriggerRef.current === document.activeElement) {
      if (isKeyboardFocus) {
        // focusing tooltip trigger shows tooltip content
        tooltipTriggerRef.current?.focus();
      } else {
        // focusing parent element hides tooltip content
        tooltipTriggerRef.current?.parentElement?.focus();
      }
    }
  }

  // https://stackoverflow.com/a/54820741 : check if tab is in focus
  useEffect(() => {
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKeyboardFocus]);

  return;
}
