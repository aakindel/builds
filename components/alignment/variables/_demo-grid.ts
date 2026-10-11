import { type GroupContract } from "./types";

type DemoGridGroup = GroupContract<
  "ui-demo-grid-preview-radius" | "ui-demo-grid-p"
>;

export const DEMO_GRID_VARIABLE_GROUP_CLASSES = {
  "$demo-grid-default": {
    "ui-demo-grid-preview-radius":
      "[--ui-demo-grid-preview-radius:var(--radius-lg)]",
    "ui-demo-grid-p": "[--ui-demo-grid-p:--spacing(3)]",
  },
} as const satisfies {
  "$demo-grid-default": DemoGridGroup;
};

/* The card's top corners surround the preview with a uniform inset.
   Derive the outer radius so changes to either input stay concentric. */
export const DEMO_GRID_RADIUS_CLASS =
  "[--ui-demo-grid-radius:calc(var(--ui-demo-grid-preview-radius)+var(--ui-demo-grid-p))]";
