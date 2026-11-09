import { notFound, redirect } from "next/navigation";
import { requireHostSession } from "@/lib/auth";
import { brandLogo, brandingOf, getProgram, liveSceneOf } from "@/lib/programs";
import { ControlPad } from "./ControlPad";

// Phone/tablet control: big buttons for sounds, score and scenes.
export default async function ControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await requireHostSession())) redirect(`/login?next=/controle/${slug}`);
  const program = await getProgram(slug);
  if (!program) notFound();
  return <ControlPad program={brandingOf(program, await brandLogo())} initialLive={liveSceneOf(program)} />;
}
