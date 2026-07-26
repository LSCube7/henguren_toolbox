import type { Metadata, Viewport } from "next";
import { AppShell } from "./components/AppShell";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import { AppI18nProvider } from "./i18n/AppI18nProvider";
import { SnackbarProvider } from "./components/Snackbar";
import { getRequestLocale } from "@/i18n/request-locale";
import { translate } from "@/i18n/config";
import "@/generated/material-symbols.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: translate(locale, "app.name"),
    description: translate(locale, "app.description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: translate(locale, "app.shortName"),
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
}

export const viewport: Viewport = {
  themeColor: "#4f7cff"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialLocale = await getRequestLocale();
  return (
    <html lang={initialLocale}>
      <body>
        <AppThemeProvider>
          <AppI18nProvider initialLocale={initialLocale}>
            <SnackbarProvider>
              <ServiceWorkerRegister />
              <AppShell>{children}</AppShell>
            </SnackbarProvider>
          </AppI18nProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
