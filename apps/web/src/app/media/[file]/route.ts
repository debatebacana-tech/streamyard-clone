import { readFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, isSafeFileName, mimeForFileName } from "@/lib/assets";

// Public on purpose: the Egress browser loads these without a session. Names
// are random, so files can't be enumerated.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const mime = isSafeFileName(file) ? mimeForFileName(file) : null;
  if (!mime) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file));
    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
