import { SerwistProvider } from "@serwist/turbopack/react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SplashScreen, splashInitScript } from "@/components/splash-screen";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_COLORS, themeInitScript } from "@/lib/theme";
import "./globals.css";

const APP_NAME = "cúmulo";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Sigue y analiza tus inversiones. Tus datos viven solo en tu dispositivo.",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-ES" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashInitScript }} />
      </head>
      <body>
        <SplashScreen />
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
          <ThemeSync />
          <AppShell>{children}</AppShell>
        </SerwistProvider>
      </body>
    </html>
  );
}
