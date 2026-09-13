import type { Metadata, Viewport } from "next";
import { MdEntryScreen } from "@/components/auth/md-entry-screen";

export const metadata: Metadata = {
  title: "CASSA Hotel | Managing Director",
  description: "Managing Director dashboard entry for CASSA Hotel.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "CASSA MD",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function ManagingDirectorEntryPage() {
  return <MdEntryScreen />;
}
