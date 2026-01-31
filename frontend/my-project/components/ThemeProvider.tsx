"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
    const [mounted, setMounted] = useState(false);

    // Get system preference
    const getSystemTheme = (): "light" | "dark" => {
        if (typeof window !== "undefined") {
            return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        return "dark";
    };

    // Apply theme to document
    const applyTheme = (newTheme: Theme) => {
        const resolved = newTheme === "system" ? getSystemTheme() : newTheme;
        setResolvedTheme(resolved);

        if (typeof document !== "undefined") {
            document.documentElement.classList.remove("light", "dark");
            document.documentElement.classList.add(resolved);
            document.documentElement.setAttribute("data-theme", resolved);
        }
    };

    // Set theme and persist
    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("kclas-theme", newTheme);
        }
        applyTheme(newTheme);
    };

    // Initialize on mount
    useEffect(() => {
        const stored = localStorage.getItem("kclas-theme") as Theme | null;
        const initialTheme = stored || "system";
        setThemeState(initialTheme);
        applyTheme(initialTheme);
        setMounted(true);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (theme === "system") {
                applyTheme("system");
            }
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // Re-apply when theme changes
    useEffect(() => {
        if (mounted) {
            applyTheme(theme);
        }
    }, [theme, mounted]);

    // Prevent flash of wrong theme
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
