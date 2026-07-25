import type { Metadata, Viewport } from "next";
import { RoleLoginPage } from "@/components/auth/role-login-page";

export const metadata: Metadata = {
  title: "CASSA Hotel | Director Dashboard",
  description: "Managing director dashboard login for CASSA Hotel.",
  manifest: "/md-manifest.webmanifest",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", sizes: "any", type: "image/png" }],
    shortcut: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "CASSA MD",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "CASSA MD",
    "application-name": "CASSA MD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function ManagingDirectorEntryPage() {
  return <RoleLoginPage role="director" />;
}
