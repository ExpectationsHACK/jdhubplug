import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

// Display: wide geometric sans for headlines. Body: neutral, highly legible sans.
const display = Montserrat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JDHub | Buy, Sell & Swap Phones, Gadgets and Cars in Nigeria",
    template: "%s | JDHub",
  },
  description:
    "Nigeria's graded trade platform. Buy, sell and swap phones, accessories, gadgets and cars with transparent grading, verified sellers and escrow-protected payment.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
