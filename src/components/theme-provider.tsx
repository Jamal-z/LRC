import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "lrc-theme"

interface ThemeContextValue {
  theme: Theme
  /** what is actually on screen right now ("system" resolved) */
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    readStoredTheme() === "dark" || (readStoredTheme() === "system" && systemPrefersDark())
      ? "dark"
      : "light"
  )

  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && systemPrefersDark())
      document.documentElement.classList.toggle("dark", dark)
      document.documentElement.style.colorScheme = dark ? "dark" : "light"
      setResolvedTheme(dark ? "dark" : "light")
    }

    apply()
    localStorage.setItem(STORAGE_KEY, theme)

    // keep following the OS while the user is on "system"
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  function toggleTheme() {
    setThemeState(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme: setThemeState, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
