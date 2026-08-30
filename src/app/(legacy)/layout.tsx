import type { Metadata, Viewport } from "next";
import { themeBootstrapScript } from "@/app/theme/theme-bootstrap";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Henguren Toolbox",
  description: "Henguren Toolbox",
  manifest: "/manifest.webmanifest",
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

export default function LegacyRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
