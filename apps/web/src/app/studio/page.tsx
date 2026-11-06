import { redirect } from "next/navigation";
import { requireHostSession } from "@/lib/auth";
import { Studio } from "./Studio";

export default async function StudioPage() {
  const session = await requireHostSession();
  if (!session) {
    redirect("/login");
  }

  return <Studio />;
}
