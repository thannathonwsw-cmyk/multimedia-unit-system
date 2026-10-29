export type Prefs = {
  theme: "dark" | "light";
  bg: "aurora" | "sunset" | "stars" | "custom";
  fontScale: number;
};

const KEY = "mm-prefs-v1";

export const defaultPrefs: Prefs = { theme: "dark", bg: "aurora", fontScale: 1 };

export const FONT_STEPS = [0.85, 0.9, 1, 1.1, 1.25];

export function loadPrefs(): Prefs {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return defaultPrefs; }
}

export function savePrefs(p: Prefs) { localStorage.setItem(KEY, JSON.stringify(p)); }

export function applyPrefs(p: Prefs) {
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.style.setProperty("--fscale", String(p.fontScale));
}

export function stepFontScale(current: number, dir: 1 | -1): number {
  let i = FONT_STEPS.reduce((best, v, idx) =>
    Math.abs(v - current) < Math.abs(FONT_STEPS[best] - current) ? idx : best, 0);
  i = Math.min(FONT_STEPS.length - 1, Math.max(0, i + dir));
  return FONT_STEPS[i];
}