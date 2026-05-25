import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "world.openfoodfacts.org" },
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
  async rewrites() {
    // Proxy Firebase Auth handler paths to the Firebase backend so that
    // signInWithRedirect can use this app's origin as authDomain. Required
    // when NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is set to the app's domain
    // (coaching-app-mvp.vercel.app) instead of the default firebaseapp.com.
    return [
      {
        source: "/__/auth/:path*",
        destination:
          "https://linsociable-coaching.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination:
          "https://linsociable-coaching.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
