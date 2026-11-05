/**
 * Modo demo: la app usa otra base de datos («cumulo-demo») con una cartera de
 * ejemplo. La de la persona no se lee ni se toca mientras dura.
 */
export const DEMO_DATABASE = "cumulo-demo";
const DEMO_KEY = "cumulo:demo";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, "1");
    else localStorage.removeItem(DEMO_KEY);
  } catch {}
}
