import type { Metadata } from "next";
import { RoleLoginPage } from "@/components/auth/role-login-page";

export const metadata: Metadata = {
  title: "CASSA Hotel Kitchen POS",
  description: "Kitchen POS login page for CASSA Hotel.",
  manifest: "/api/pwa-manifest/kitchen",
};

export default function KitchenPosEntryPage() {
  return <RoleLoginPage role="kitchen" />;
}
