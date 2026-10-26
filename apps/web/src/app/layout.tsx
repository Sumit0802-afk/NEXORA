import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./theme-dark.css";
import "./theme-dark.overrides.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-auth", display: "swap" });

export const metadata: Metadata = {
  title: "NEXORA",
  description: "Design thoughtful home floor plans with a hands-on 2D editor and an immersive 3D preview."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
