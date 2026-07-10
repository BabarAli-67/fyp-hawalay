import { useTheme } from '../../context/ThemeContext.jsx';

const BTN =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high/60 hover:text-primary transition-all duration-200 active:scale-95 sm:h-10 sm:w-10';

/**
 * Sun/Moon theme switch — visible in Navbar for guests and signed-in users.
 */
export function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`${BTN} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span
        className="material-symbols-outlined text-[22px] transition-transform duration-300"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden
      >
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
