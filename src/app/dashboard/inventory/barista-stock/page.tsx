import { redirect } from "next/navigation";

export default function LegacyBaristaStockPage() {
  redirect("/dashboard/inventory/bar-stock");
}
