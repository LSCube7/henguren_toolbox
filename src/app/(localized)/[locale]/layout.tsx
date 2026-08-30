import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { ServiceWorkerRegister } from "@/app/components/ServiceWorkerRegister";
import { AppThemeProvider } from "@/app/theme/AppThemeProvider";
import { AppI18nProvider } from "@/app/i18n/AppI18nProvider";
import { SnackbarProvider } from "@/app/components/Snackbar";
import { themeBootstrapScript } from "@/app/theme/theme-bootstrap";
import { isAppLocale, supportedLocales, translate, type AppLocale } from "@/i18n/config";
import { Suspense } from "react";
import "@/generated/material-symbols.css";
import "@/app/globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

async function readLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  return rawLocale;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await readLocale(params);
  return {
    title: translate(locale, "app.name"),
    description: translate(locale, "app.description"),
    manifest: `/manifest.${locale}.webmanifest`,
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

export default async function LocaleRootLayout({
  children,
  params
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const locale = await readLocale(params);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AppThemeProvider>
          <AppI18nProvider initialLocale={locale}>
            <SnackbarProvider>
              <ServiceWorkerRegister />
              <Suspense fallback={null}>
                <AppShell>{children}</AppShell>
              </Suspense>
            </SnackbarProvider>
          </AppI18nProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
