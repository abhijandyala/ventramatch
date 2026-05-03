import { redirect } from "next/navigation";
import type { Route } from "next";

export default function SettingsPage() {
  redirect("/settings/account" as Route);
}
