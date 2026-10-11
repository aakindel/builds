import { startTransition, useEffect, useState } from "react";
import { useDrag } from "@use-gesture/react";

type UseResizeProps = {
  initialSize: number | undefined;
  minSize: number | (() => number);
  maxSize: number | (() => number);
  direction?: "top" | "right" | "bottom" | "left";
};

export function useResize({
  initialSize,
  minSize,
  maxSize,
  direction = "right",
}: UseResizeProps) {
  const [size, setSize] = useState(initialSize);

  useEffect(() => {
    if (size === undefined) {
      setSize(initialSize);
    }
  }, [initialSize, size]);

  const bindResize = useDrag(
    ({ delta }) => {
      startTransition(() => {
        setSize((oldSize) => {
          const newSize =
            (oldSize as number) +
            delta[["left", "right"].includes(direction) ? 0 : 1] *
              (["right", "bottom"].includes(direction) ? 1 : -1);

          const innerMinSize =
            typeof minSize === "function" ? minSize() : minSize;

          const innerMaxSize =
            typeof maxSize === "function" ? maxSize() : maxSize;

          if (newSize < innerMinSize) {
            return innerMinSize;
          }

          if (newSize > innerMaxSize) {
            return innerMaxSize < innerMinSize ? innerMinSize : innerMaxSize;
          }

          return Math.round(newSize);
        });
      });
    },
    {
      eventOptions: { passive: false },
      preventDefault: true,
    }
  );
  return { size, setSize, bindResize };
}
