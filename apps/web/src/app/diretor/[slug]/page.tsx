import { notFound, redirect } from "next/navigation";
import { requireHostSession } from "@/lib/auth";
import { brandLogo, brandingOf, draftSceneOf, getProgram, liveSceneOf } from "@/lib/programs";
import { DirectorStudio } from "./DirectorStudio";

export default async function DirectorProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireHostSession())) redirect("/login");

  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();

  return (
    <DirectorStudio
      program={brandingOf(program, await brandLogo())}
      initialScenes={{ live: liveSceneOf(program), draft: draftSceneOf(program) }}
    />
  );
}
