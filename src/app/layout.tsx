import type { Metadata, Viewport } from "next";
import { AppShell } from "./components/AppShell";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import { AppI18nProvider } from "./i18n/AppI18nProvider";
import "@/generated/material-symbols.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "恨古人工具箱",
  description: "面向语文与英语学习的轻量工具箱。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "恨古人",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/img/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/img/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" }
    ],
    apple: [{ url: "/img/icons/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#4f7cff"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppThemeProvider>
          <AppI18nProvider>
            <ServiceWorkerRegister />
            <AppShell>{children}</AppShell>
          </AppI18nProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
