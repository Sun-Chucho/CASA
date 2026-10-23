import { redirect } from "next/navigation";

export default function LegacyStockMovementPage() {
  redirect("/dashboard/inventory/stock-downloads");
}
