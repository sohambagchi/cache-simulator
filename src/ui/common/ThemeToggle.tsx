export type ThemeMode = "light" | "dark";

type ThemeToggleProps = {
  theme: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="theme-toggle"
      aria-label="Toggle theme"
      aria-pressed={theme === "dark"}
      onClick={onToggle}
    >
      {theme === "light" ? "\u2600" : "\u263D"}
    </button>
  );
}
