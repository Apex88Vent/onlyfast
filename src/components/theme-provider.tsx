"use client"

import * as React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { ThemeProviderProps } from "next-themes/dist/types"

type Theme = "dark" | "light" | "system"

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const storageGet = (key: string): string | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null
  } catch {
    return null
  }
}

const storageSet = (key: string, value: string): void => {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value)
  } catch {
    /* Storage can be unavailable in restricted WebViews. */
  }
}

const matchesMedia = (query: string): boolean => {
  try {
    return typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches
  } catch {
    return false
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  value: _value,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = storageGet("theme")
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system")) return savedTheme
    return defaultTheme as Theme
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = matchesMedia("(prefers-color-scheme: dark)") ? "dark" : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value: ThemeContextType = {
    theme,
    setTheme: (theme: Theme) => {
      storageSet("theme", theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeContext.Provider value={value} {...props}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
