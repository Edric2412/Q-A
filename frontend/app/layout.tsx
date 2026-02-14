import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import "./theme-transitions.css";

export const metadata: Metadata = {
  title: "KCLAS - Question Paper Generator",
  description: "AI-Powered Question Paper Generator and Answer Evaluator for Kumaraguru College of Liberal Arts & Science",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Sans Flex Font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Remix Icons */}
        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        {/* Prevent FOUC - detect theme before render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
                            (function() {
                                try {
                                    var stored = localStorage.getItem('kclas-theme');
                                    var theme = stored || 'system';
                                    var resolved = theme;
                                    if (theme === 'system') {
                                        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                    }
                                    document.documentElement.classList.add(resolved);
                                    document.documentElement.setAttribute('data-theme', resolved);
                                } catch (e) {}
                            })();
                        `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
