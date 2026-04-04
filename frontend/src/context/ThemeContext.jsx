import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const FONTS = {
  inter: "'Inter', sans-serif",
  mono: "'Courier New', monospace",
  serif: "'Georgia', serif"
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [accent, setAccent] = useState(() => localStorage.getItem("accent") || "#a78bfa");
  const [font, setFont] = useState(() => localStorage.getItem("font") || "inter");
  const [layout, setLayout] = useState(() => localStorage.getItem("layout") || "grid");
  const [oceanMode, setOceanMode] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-hover", accent + "cc");
    document.documentElement.style.setProperty("--border-hover", accent);
    document.documentElement.style.setProperty("--tag-text", accent);
    localStorage.setItem("accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font", FONTS[font] || FONTS.inter);
    localStorage.setItem("font", font);
  }, [font]);

  useEffect(() => { localStorage.setItem("layout", layout); }, [layout]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  const toggleOcean = () => {
    setOceanMode(prev => {
      if (!prev) setAccent("#38bdf8");
      return !prev;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, accent, setAccent, font, setFont, layout, setLayout, oceanMode, toggleOcean }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
