export const THEME_STORAGE_KEY = 'hawalay-theme';

/** @returns {'light' | 'dark' | null} */
export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable in private mode.
  }
  return null;
}

/** @returns {'light' | 'dark'} */
export function getSystemTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** @returns {'light' | 'dark'} */
export function resolveTheme() {
  return getStoredTheme() ?? getSystemTheme();
}

/** @param {'light' | 'dark'} theme */
export function applyThemeToDocument(theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#101414' : '#006c49';
  }
}

/** @param {'light' | 'dark'} theme */
export function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures.
  }
}
