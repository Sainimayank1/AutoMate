import { useEffect } from "react";

/** Paper is light: a printable page drops the dark theme while it's open, and restores it after. */
export function useLightPage() {
  useEffect(() => {
    const root = document.documentElement;
    const dark = root.classList.contains("dark");
    const scheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (dark) root.classList.add("dark");
      root.style.colorScheme = scheme;
    };
  }, []);
}
