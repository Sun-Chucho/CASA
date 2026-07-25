import type { Metadata } from "next";
import { RoleLoginPage } from "@/components/auth/role-login-page";

export const metadata: Metadata = {
  title: "CASSA Hotel | Manager Login",
  description: "Hotel manager login page for CASSA Hotel.",
};

export default function ManagerEntryPage() {
  return <RoleLoginPage role="manager" />;
}
