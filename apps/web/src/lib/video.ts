import { execFile } from "child_process";
import { open, rename, stat, unlink } from "fs/promises";
import { promisify } from "util";

const run = promisify(execFile);

// Whether the MP4 index (moov box) comes before the media data, so playback
// can start while the file downloads. Walks the top-level boxes.
async function moovFirst(file: string): Promise<boolean> {
  const fh = await open(file, "r");
  try {
    const size = (await fh.stat()).size;
    const head = Buffer.alloc(16);
    let pos = 0;
    while (pos + 8 <= size) {
      await fh.read(head, 0, 16, pos);
      let len = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      if (len < 8) return false;
      pos += len;
    }
    return false;
  } finally {
    await fh.close();
  }
}

type Probe = { codec: string; height: number; bitRate: number; faststart: boolean };

async function probe(file: string): Promise<Probe | null> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,height:format=bit_rate",
      "-of", "json", file,
    ]);
    const data = JSON.parse(stdout) as { streams?: { codec_name?: string; height?: number }[]; format?: { bit_rate?: string } };
    const s = data.streams?.[0];
    if (!s) return null;
    return { codec: s.codec_name ?? "", height: s.height ?? 0, bitRate: Number(data.format?.bit_rate ?? 0), faststart: await moovFirst(file) };
  } catch {
    return null;
  }
}

// Makes an uploaded MP4/MOV play everywhere (browsers on any system and the
// stream output): HEVC (iPhone/Mac exports), very heavy or >1080p videos are
// converted to H.264 720p; already-fine H.264 is only rearranged so it starts
// playing while downloading. Writes the result to `output` (MP4).
// Returns false when ffmpeg isn't available or fails (keep the original then).
export async function normalizeVideo(input: string, output: string): Promise<boolean> {
  const info = await probe(input);
  if (!info) return false;
  const ok = info.codec === "h264" && info.height <= 1080 && info.bitRate > 0 && info.bitRate <= 8_000_000;
  if (ok && info.faststart) return false; // already fine: keep as is
  const tmp = `${output}.tmp.mp4`;
  const args = ok
    ? ["-y", "-v", "error", "-i", input, "-c", "copy", "-movflags", "+faststart", tmp]
    : [
        "-y", "-v", "error", "-i", input,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
        "-vf", "scale=-2:'min(720,ih)'",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp,
      ];
  try {
    // Low priority: a conversion must not starve a live show.
    await run("nice", ["-n", "15", "ffmpeg", ...args], { maxBuffer: 1 << 24 });
    await rename(tmp, output);
    return (await stat(output)).size > 0;
  } catch (err) {
    console.error("video conversion failed", err);
    await unlink(tmp).catch(() => {});
    return false;
  }
}
