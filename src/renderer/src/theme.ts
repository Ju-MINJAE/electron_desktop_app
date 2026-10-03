export type ThemePreference = 'system' | 'light' | 'dark'
const key = 'totalcontrolpro.theme.v1'
export function readTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* Use the system theme when storage is unavailable. */
  }
  return 'system'
}
export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
}
export function saveTheme(theme: ThemePreference): void {
  localStorage.setItem(key, theme)
}
