"use client";

import { useCallback, useState } from "react";
import { setAppCookie } from "@/utils";

export function useStateWithCookies<T = void, U extends T = T>({
  cookieName,
  defaultValue,
  value: valueProp,
  onValueChange: onValueChangeProp,
}: {
  cookieName: string | undefined;
  defaultValue: U;
  value?: U;
  onValueChange?: (value: U) => void;
}) {
  const [_innerValue, _setInnerValue] = useState(() => {
    if (typeof window === "undefined") {
      /* defaultValue should be read from header cookie wherever 
         server component is called to match client cookie below */
      return defaultValue;
    }
    // read initial state from cookie when component mounts (client-side)
    return defaultValue;
  });
  const customState = valueProp ?? _innerValue;
  const setCustomState = useCallback(
    (value: U | ((value: U) => U)) => {
      const valueFunction = value as (prev: U) => U;
      const valueState =
        typeof value === "function" ? valueFunction(customState) : value;
      if (onValueChangeProp) {
        onValueChangeProp(valueState);
      } else {
        _setInnerValue(valueState);
      }
      setAppCookie({ cookieName, cookieValue: valueState });
    },
    [onValueChangeProp, customState, cookieName]
  );

  return { state: customState, setState: setCustomState };
}
