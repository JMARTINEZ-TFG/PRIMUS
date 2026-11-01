import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Preferencia de tema guardada en el navegador. El script THEME_INIT_SCRIPT (en
// __root.tsx) la aplica antes de que se pinte la página para evitar un parpadeo.
export const THEME_STORAGE_KEY = "primus_theme";

export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export function ThemeToggle() {
  // En el servidor no se conoce el tema: se lee del documento después de montar
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light"); } catch { /* sin almacenamiento */ }
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card transition hover:bg-muted"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">{dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}</span>
    </button>
  );
}
