import type { Metadata } from "next";
import { JetBrains_Mono, Syne, Work_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Log Lens",
  description: "多服务多节点日志合并分析工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${syne.variable} ${workSans.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
