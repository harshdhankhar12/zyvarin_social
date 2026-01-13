import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"], 
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zyvarin.com"),
  title: {
    default: "Zyvarin Social | Write Once, Publish Everywhere",
    template: "%s | Zyvarin Social",
  },
  description:
    "Zyvarin Social is an AI-powered cross-posting tool that lets you write content once and automatically repurpose and publish it to LinkedIn, X (Twitter), Medium, and more from a single dashboard.",
  keywords: [
    "Zyvarin",
    "Zyvarin Social",
    "AI cross posting",
    "social media scheduling",
    "content repurposing",
    "LinkedIn posts",
    "Twitter posts",
    "Medium articles",
    "social media automation",
    "content distribution",
    "multi-platform posting",
    "social media management",
    "AI content optimization",
    "schedule social posts",
    "cross-platform scheduler",
  ],
  authors: [{ name: "Zyvarin Team" }],
  creator: "Zyvarin",
  publisher: "Zyvarin Social",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zyvarin.com",
    siteName: "Zyvarin Social",
    title: "Zyvarin Social | AI Cross-Posting Engine",
    description:
      "Write once, repurpose with AI, and publish everywhere. Manage LinkedIn, X, Medium and more from one clean dashboard.",
    images: [
      {
        url: "https://zyvarin.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zyvarin Social - AI-Powered Social Media Scheduler",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@zyvarin",
    creator: "@zyvarin",
    title: "Zyvarin Social | AI Cross-Posting Engine",
    description:
      "Write once, repurpose with AI, and publish everywhere from a single dashboard.",
    images: ["https://zyvarin.com/twitter-card.png"],
  },
  alternates: {
    canonical: "https://zyvarin.com",
  },
  verification: {
    google: "google-site-verification-code",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=G-51NY69XWVF`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', 'G-51NY69XWVF');
                `,
              }}
            />
          </>
      </head>
      <body cz-shortcut-listen="true"
      className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
