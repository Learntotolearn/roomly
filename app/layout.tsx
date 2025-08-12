import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import QueryProvider from "@/lib/context/query-provider";
import { AppProvider } from "@/lib/context/app-context";
import { getSystemTheme } from "@/lib/utils";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";

// 本地字体加载
const geistSans = localFont({
  src: [
    {
      path: "../public/fonts/Geist-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    {
      path: "../public/fonts/GeistMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "会议室预定系统",
  description: "会议室预定管理系统",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const theme = headersList.get('x-theme');

  return (
    <html lang="zh-CN" className={getSystemTheme(theme)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AppProvider>
            {children}
            <Toaster />
          </AppProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
