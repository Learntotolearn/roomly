import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/context/query-provider";
import { AppProvider } from "@/lib/context/app-context";
import { getSystemTheme } from "@/lib/utils";
import { headers } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
          </AppProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
