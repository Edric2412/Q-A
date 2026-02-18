"use client";

import { useTheme } from "./ThemeProvider";
import "./ThemeToggle.css";

interface ThemeToggleProps {
    className?: string;
    showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
    const { theme, setTheme, resolvedTheme } = useTheme();

    const cycleTheme = () => {
        // Cycle: light -> dark -> system -> light
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
    };

    const getIcon = () => {
        if (theme === "system") {
            return "ri-computer-line";
        }
        return resolvedTheme === "dark" ? "ri-moon-line" : "ri-sun-line";
    };

    const getLabel = () => {
        if (theme === "system") return "System";
        return theme === "dark" ? "Dark Mode" : "Light Mode";
    };

    return (
        <button
            className={`theme-toggle ${showLabel ? "w-auto px-4 justify-start gap-3" : ""} ${className}`}
            onClick={cycleTheme}
            title={`Current theme: ${getLabel()}`}
            aria-label={`Current theme: ${getLabel()}. Click to change.`}
        >
            <i className={`${getIcon()} text-lg`}></i>
            {showLabel && <span className="text-sm font-medium">{getLabel()}</span>}
        </button>
    );
}
