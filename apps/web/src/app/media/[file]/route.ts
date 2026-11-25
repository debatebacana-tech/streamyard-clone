import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { UPLOAD_DIR, isSafeFileName, mimeForFileName } from "@/lib/assets";

// Public on purpose: the Egress browser loads these without a session. Names
// are random, so files can't be enumerated. Byte ranges are served so videos
// can start mid-way (projected videos join in sync) and stream instead of
// loading whole into memory.
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const mime = isSafeFileName(file) ? mimeForFileName(file) : null;
  if (!mime) return new Response("Not found", { status: 404 });

  const filePath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
