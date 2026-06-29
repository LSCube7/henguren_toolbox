import type { Metadata } from "next";
import { AppShell } from "./components/AppShell";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "恨古人工具箱 v3",
  description: "面向语文与英语学习的 Henguren Toolbox v3。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppThemeProvider>
          <AppShell>{children}</AppShell>
        </AppThemeProvider>
      </body>
    </html>
  );
}
