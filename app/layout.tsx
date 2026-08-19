import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "拾光笺｜把今天的一点光，轻轻收好",
  description: "嵌在飞书里的轻量灵感与感谢记录工具。",
  openGraph: {
    title: "拾光笺｜把今天的一点光，轻轻收好",
    description: "随手收藏灵感、启发与感谢，让零散记录成为一份时间礼物。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "拾光笺" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "拾光笺｜把今天的一点光，轻轻收好",
    description: "随手收藏灵感、启发与感谢，让零散记录成为一份时间礼物。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
