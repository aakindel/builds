"use client";

import { useTheme } from "next-themes";
import { Icons } from "./icons";
import { Button } from "./ui/button";

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();

  function changeTheme() {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  }

  return (
    <Button
      variant="muted"
      size="icon-xs"
      className={className}
      aria-label="Theme Toggle"
      onClick={changeTheme}
    >
      <Icons.sun className="flex dark:hidden" />
      <Icons.moon className="hidden dark:flex" />
    </Button>
  );
};
