import { useEffect, useState } from "react";

export function useIsPageLoading() {
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    setIsPageLoading(false);
  }, []);

  // https://stackoverflow.com/a/57548987 : require generic parameter
  function getPageLoadedVariable<T = void, U extends T = T>({
    variable,
    defaultValue,
  }: {
    variable: U;
    defaultValue: U;
  }): U {
    return isPageLoading ? (defaultValue as U) : (variable as U);
  }

  return {
    isPageLoading,
    getPageLoadedVariable: getPageLoadedVariable as GetPageLoadedVariableFnType,
  };
}

export type GetPageLoadedVariableFnType = <T = void, U extends T = T>({
  variable,
  defaultValue,
}: {
  variable: U;
  defaultValue: U;
}) => U;
