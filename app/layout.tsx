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
  title: {
    default: "诺崇科技｜企业知识与智能培训平台",
    template: "%s｜诺崇科技",
  },
  description:
    "云南诺崇科技有限公司专注企业 AI 应用，通过企业知识库、智能培训、考试测评与 AI 助手，推动人员培养和组织能力持续提升。",
  keywords: ["企业知识库", "企业培训平台", "在线考试", "AI知识库", "诺崇科技"],
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
