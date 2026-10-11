import { useState } from "react";
import { consoleError } from "@/utils";

export function useOuterOrInnerState<T>({
  outerState,
  outerSetState,
  defaultValue,
}: {
  outerState?: T;
  outerSetState?: React.Dispatch<React.SetStateAction<T>>;
  defaultValue: T;
}): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [innerState, setInnerState] = useState(defaultValue);

  const shouldUseOuterState =
    outerState !== undefined && outerSetState !== undefined;

  if (outerState && outerSetState === undefined) {
    consoleError(
      "ERROR in useOuterOrInnerState: outerState is defined but outerSetState is undefined, so innerState will be used instead"
    );
  } else if (outerState === undefined && outerSetState) {
    consoleError(
      "ERROR in useOuterOrInnerState: outerState is undefined but outerSetState is defined, so innerState will be used instead"
    );
  }

  const stateValue = shouldUseOuterState ? outerState : innerState;
  const setStateValue = shouldUseOuterState ? outerSetState : setInnerState;

  return [stateValue, setStateValue];
}
