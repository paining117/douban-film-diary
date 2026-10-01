import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "片刻 · Top250 观影手记",
  description: "豆瓣 Top250 打卡、观影笔记与云端进度记录。",
  other: {
    "codex-preview": "development",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
