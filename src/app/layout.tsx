import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSSSB TGT S.St Practice",
  description: "Practice MCQs for the DSSSB TGT Social Studies exam.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#faf9f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#efece3]">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_40px_rgba(0,0,0,0.06)]">
          {children}
        </div>
      </body>
    </html>
  );
}
