import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/desktop/?admin=1");
}
