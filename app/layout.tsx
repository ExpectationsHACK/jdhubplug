import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/components/home/site";
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
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "JDHub | Buy, Sell & Swap Phones, Gadgets and Cars in Nigeria",
    template: "%s | JDHub",
  },
  description: SITE_DESCRIPTION,
  keywords: ["buy used iPhone Nigeria", "sell phone Lagos", "swap phone", "graded phones", "used cars Nigeria", "escrow"],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    title: "JDHub | Trade with certainty",
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "JDHub | Trade with certainty", description: SITE_DESCRIPTION },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
