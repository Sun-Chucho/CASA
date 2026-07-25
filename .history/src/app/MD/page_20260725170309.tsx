import type { Metadata, Viewport } from "next";
import { RoleLoginPage } from "@/components/auth/role-login-page";

export const metadata: Metadata = {
  title: "CASA MD Dashboard",
  description: "Managing director mobile dashboard login for CASA.",
  manifest: "/md-manifest.webmanifest",
  icons: {
    icon: [
      { url: "/casa-logo.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/casa-logo.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/casa-logo.svg", sizes: "any", type: "image/svg+xml" }],
    shortcut: "/casa-logo.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Orange MD",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Orange MD",
    "application-name": "Orange MD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#065f46",
};

export default function ManagingDirectorEntryPage() {
  return <RoleLoginPage role="director" />;
}
