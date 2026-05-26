import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono, Major_Mono_Display, Noto_Serif } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PWAInstaller } from "@/components/pwa/pwa-installer";
import { Toaster } from "@/components/ui/toaster";
import { MatrixRain } from "@/components/nodream/matrix-rain";
import "./globals.css";
import "./nodream-tactical.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const majorMonoDisplay = Major_Mono_Display({
  variable: "--font-major-mono",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "NoDream · Tactical OS",
  description: "Pas de rêve. Des résultats. Coaching IA militaire, hébergé en Europe.",
  manifest: "/manifest.json",
  applicationName: "NoDream",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NoDream",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#06030f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${jetbrainsMono.variable} ${majorMonoDisplay.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
        />
      </head>
      <body
        data-palette="matrix"
        className="min-h-full flex flex-col font-sans bg-background text-foreground"
      >
        <MatrixRain enabled opacity={0.18} />
        <AuthProvider>
          <PWAInstaller />
          <Toaster>{children}</Toaster>
        </AuthProvider>
      </body>
    </html>
  );
}
