import { cva, type VariantProps } from "class-variance-authority";
import { classObject, cn, withClass } from "@/utils";
import {
  APP_VARIABLE_CLASSES,
  BUTTON_CIRCLE_RADIUS_CLASS,
} from "@/components/alignment";

const buttonColorClasses = {
  default: {
    bg: withClass({
      main: "bg-primary",
      hover:
        "hover:bg-[color-mix(in_oklch,var(--color-primary)_85%,white)] dark:hover:bg-[color-mix(in_oklch,var(--color-primary)_90%,black)]",
    }),
  },
  destructive: {
    bg: withClass({
      main: "bg-destructive",
      hover:
        "hover:bg-[color-mix(in_oklch,var(--color-destructive)_95%,black)] dark:hover:bg-[color-mix(in_oklch,var(--color-red-500)_55%,transparent)]",
    }),
  },
  outline: {
    bg: withClass({
      main: "bg-surface",
      hover:
        "hover:bg-[color-mix(in_oklch,var(--color-secondary)_80%,white)] dark:hover:bg-secondary",
    }),
  },
  secondary: {
    bg: withClass({
      main: "bg-secondary",
      hover:
        "hover:bg-[color-mix(in_oklch,var(--color-secondary)_97%,black)] dark:hover:bg-[color-mix(in_oklch,var(--color-secondary)_95%,white)]",
    }),
  },
  ghost: {
    bg: withClass({
      hover: "hover:bg-secondary",
    }),
  },
};

export type ButtonVariantType = keyof typeof buttonVariantClasses;

// UPDATE: shadcn-ui/lint update (new button variants)
export const newButtonVariantClasses = {
  "outline-muted": cn(
    // bg
    buttonColorClasses.outline.bg.class,
    // text
    "text-muted-foreground hover:text-primary",
    // border
    "border-boundary border"
  ),
  muted: cn(
    // bg
    buttonColorClasses.ghost.bg.class,
    // text — stay subdued on hover (topbar icon buttons)
    "text-subdued hover:text-subdued!"
  ),
  "secondary-subdued": cn(
    // bg
    buttonColorClasses.secondary.bg.class,
    // text — stay subdued on hover (topbar icon buttons)
    "text-subdued"
  ),
  chip: cn(
    // bg
    "bg-floater data-[dimmed]:bg-floater/60",
    // text
    "text-xs",
    // border
    "border-boundary border",
    // effects
    "duration-0 data-[dimmed]:opacity-60"
  ),
  quiet: cn(
    // bg
    "hover:bg-muted data-popup-open:bg-muted",
    // text
    "text-muted-foreground! text-xs font-medium",
    // existing direct-child SVG treatment, distinct from Button's prefix API
    "items-center has-[>svg]:pr-2 has-[>svg]:pl-1.5"
  ),
};

const buttonToolbarSpacingClasses = {
  chip: cn(
    APP_VARIABLE_CLASSES.button(
      [
        "ui-button-py",
        "ui-button-px",
        "ui-button-leading",
        "ui-button-gap",
        "ui-button-radius",
      ],
      "$button-chip"
    )
  ),
  quiet: cn(
    APP_VARIABLE_CLASSES.button(
      [
        "ui-button-py",
        "ui-button-px",
        "ui-button-leading",
        "ui-button-gap",
        "ui-button-radius",
      ],
      "$button-quiet"
    )
  ),
} as const;

export const buttonVariantClasses = {
  default: cn(
    // bg
    buttonColorClasses.default.bg.class,
    // text
    "text-primary-foreground"
  ),
  destructive: cn(
    // bg
    buttonColorClasses.destructive.bg.class,
    // text
    "text-static-light"
  ),
  outline: cn(
    // "shadow-xs",
    // bg
    buttonColorClasses.outline.bg.class,
    // text
    "hover:text-primary",
    // border
    "border-boundary border"
  ),
  secondary: cn(
    // bg
    buttonColorClasses.secondary.bg.class,
    // text
    "text-primary"
  ),
  ghost: cn(
    // bg
    buttonColorClasses.ghost.bg.class,
    // text
    "hover:text-primary"
  ),
  highlight: cn(
    // text
    "text-subdued hover:text-muted-foreground"
  ),
  link: cn(
    // text
    "underline-offset-4 hover:underline",
    "text-sm font-normal",
    "text-subdued",
    "data-[variant=link]:rounded-xs",
    "data-[variant=link]:h-auto data-[variant=link]:py-0",
    // use -mx-px and px-px not px-0 to give link more space when focus-visible
    "data-[variant=link]:-mx-px data-[variant=link]:px-px"
  ),
  // UPDATE: shadcn-ui/lint update (new button variants)
  ...newButtonVariantClasses,
};

export type ButtonSizeType = keyof typeof buttonSizeClasses;

const iconButtonSizeClasses = classObject({
  "icon-xs": cn(
    /* ui-button-radius must be defined per size or else radius is 0 */
    APP_VARIABLE_CLASSES.button(
      ["ui-button-size", "ui-button-icon-size", "ui-button-radius"],
      "$button-icon-button-xsmall"
    ),
    "p-svg-0 size-(--ui-button-size) shrink-0 p-0"
  ),
  "icon-sm": cn(
    /* ui-button-radius must be defined per size or else radius is 0 */
    APP_VARIABLE_CLASSES.button(
      ["ui-button-size", "ui-button-icon-size", "ui-button-radius"],
      "$button-icon-button-small"
    ),
    "p-svg-0 size-(--ui-button-size) shrink-0 p-0"
  ),
  icon: cn(
    /* ui-button-radius must be defined per size or else radius is 0 */
    APP_VARIABLE_CLASSES.button(
      ["ui-button-size", "ui-button-icon-size", "ui-button-radius"],
      "$button-icon-button-default"
    ),
    "p-svg-0 size-(--ui-button-size) shrink-0 p-0"
  ),
});

export type IconButtonSizeType = keyof typeof iconButtonSizeClasses;

export const buttonSizeClasses = classObject({
  sm: cn(
    /* ui-button-radius must be defined per size or else radius is 0 */
    APP_VARIABLE_CLASSES.button(["ui-button-radius"], "$button-small"),
    APP_VARIABLE_CLASSES.button(
      ["ui-button-py", "ui-button-px", "ui-button-leading", "ui-button-gap"],
      "$button-small"
    ),
    APP_VARIABLE_CLASSES.button(
      ["ui-button-icon-container-size", "ui-button-icon-size"],
      "$button-icon-small"
    ),
    "py-(--ui-button-py)",
    "leading-(--ui-button-leading)",
    "gap-(--ui-button-gap)",
    "px-(--ui-button-px)"
  ),
  default: cn(
    /* ui-button-radius must be defined per size or else radius is 0 */
    APP_VARIABLE_CLASSES.button(["ui-button-radius"], "$button-default"),
    APP_VARIABLE_CLASSES.button(
      ["ui-button-py", "ui-button-px", "ui-button-leading", "ui-button-gap"],
      "$button-default"
    ),
    APP_VARIABLE_CLASSES.button(
      ["ui-button-icon-container-size", "ui-button-icon-size"],
      "$button-icon-default"
    ),
    "py-(--ui-button-py)",
    "leading-(--ui-button-leading)",
    "gap-(--ui-button-gap)",
    "px-(--ui-button-px)"
  ),
  ...iconButtonSizeClasses,
});

export type ButtonShapeType = "square" | "circle";

export const buttonShapeClasses: Record<ButtonShapeType, string> = classObject({
  square: "",
  circle: BUTTON_CIRCLE_RADIUS_CLASS,
});

export const buttonDefaultVariants: {
  variant: ButtonVariantType;
  size: keyof typeof buttonSizeClasses;
  shape: ButtonShapeType;
} = {
  variant: "default",
  size: "default",
  shape: "square",
};

const buttonVariantsCva = cva(
  cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap outline-none",
    // border
    "border border-transparent",
    // text
    "text-sm font-medium",
    "rounded-(--ui-button-radius)",
    // transition
    "transition-colors duration-150",
    // [&_svg]
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--ui-button-icon-size)",
    // disabled
    // "disabled:pointer-events-none disabled:opacity-50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "data-loading:cursor-not-allowed",
    // focus-visible
    "focus-visible:app-active-ring",
    // aria-invalid
    "app-aria-invalid-border"
  ),
  {
    variants: {
      variant: buttonVariantClasses,
      size: buttonSizeClasses,
      shape: buttonShapeClasses,
    },
    compoundVariants: [
      {
        variant: "chip",
        size: "default",
        class: buttonToolbarSpacingClasses.chip,
      },
      {
        variant: "chip",
        size: "sm",
        class: buttonToolbarSpacingClasses.chip,
      },
      {
        variant: "quiet",
        size: "default",
        class: buttonToolbarSpacingClasses.quiet,
      },
      {
        variant: "quiet",
        size: "sm",
        class: buttonToolbarSpacingClasses.quiet,
      },
    ],
    defaultVariants: buttonDefaultVariants,
  }
);

/* Size first, then chip/quiet replace the spacing group, then shape may
   replace radius. Caller className stays last at the Button merge. */
export function buttonVariants({
  variant,
  size,
  shape = "square",
  className,
}: VariantProps<typeof buttonVariantsCva> & { className?: string } = {}) {
  return cn(
    buttonVariantsCva({ variant, size }),
    buttonShapeClasses[shape ?? "square"],
    className
  );
}
