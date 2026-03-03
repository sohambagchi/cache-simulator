import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="theme-toggle"
      aria-label="Toggle theme"
      aria-pressed={theme === "dark"}
      onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
    >
      Theme: {theme === "light" ? "Light" : "Dark"}
    </button>
  );
}
