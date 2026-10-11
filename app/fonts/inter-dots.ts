import localFont from "next/font/local";

/* Inter `.` / `…` / `•` only. `font-sans-plus` (in variables.css) lists this
   face first so those characters use Inter; every other character skips it
   and uses Geist (Geist `.` / `…` are square and tight; `•` for password fields
   requires tracking-widest to look good whereas Inter `•` looks good by default).
   `adjustFontFallback: false` — this is a 3-glyph overlay, not a full face. */
export const fontInterDots = localFont({
  src: "./inter-dots.woff2",
  display: "swap",
  weight: "100 900",
  style: "normal",
  preload: true,
  adjustFontFallback: false,
  variable: "--font-inter-dots",
  declarations: [{ prop: "unicode-range", value: "U+002E, U+2022, U+2026" }],
});
