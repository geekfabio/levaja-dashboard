export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "tema";

export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
