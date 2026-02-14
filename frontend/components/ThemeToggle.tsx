"use client";

import { useTheme } from "./ThemeProvider";
import "./ThemeToggle.css";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();

    const cycleTheme = () => {
        const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
        setTheme(nextTheme);
    };

    const getIcon = () => {
        if (theme === "system") {
            return "ri-computer-line";
        }
        return resolvedTheme === "dark" ? "ri-moon-line" : "ri-sun-line";
    };

    const getLabel = () => {
        if (theme === "system") return "System";
        return theme === "dark" ? "Dark" : "Light";
    };

    return (
        <button
            className="theme-toggle"
            onClick={cycleTheme}
            title={`Theme: ${getLabel()}`}
            aria-label={`Current theme: ${getLabel()}. Click to change.`}
        >
            <i className={getIcon()}></i>
        </button>
    );
}
