import type { Metadata } from "next";
import { RoleLoginPage } from "@/components/auth/role-login-page";

export const metadata: Metadata = {
  title: "CASSA Hotel Reception Booking",
  description: "Reception booking login page for CASSA Hotel.",
};

export default function ReceptionBookingEntryPage() {
  return <RoleLoginPage role="cashier" />;
}
