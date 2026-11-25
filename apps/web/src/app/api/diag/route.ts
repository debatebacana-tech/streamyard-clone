import os from "node:os";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { getLiveState } from "@/lib/live";

// Server health for the director (and for support): load, memory and the
// stream state, readable through the site itself.
async function proc(path: string) {
  return readFile(path, "utf8").catch(() => "");
}

export async function GET() {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const mem = await proc("/proc/meminfo");
  const kb = (key: string) => Number(new RegExp(`${key}:\\s+(\\d+)`).exec(mem)?.[1] ?? 0) / 1024;
  const stat1 = (await proc("/proc/stat")).split("\n")[0].split(/\s+/).slice(1).map(Number);
  await new Promise((r) => setTimeout(r, 1000));
  const stat2 = (await proc("/proc/stat")).split("\n")[0].split(/\s+/).slice(1).map(Number);
  const total = stat2.reduce((a, b) => a + b, 0) - stat1.reduce((a, b) => a + b, 0);
  const idle = stat2[3] + (stat2[4] ?? 0) - (stat1[3] + (stat1[4] ?? 0));
  const cg = (await proc("/sys/fs/cgroup/memory.current")).trim();
  return NextResponse.json({
    cpus: os.cpus().length,
    cpuBusyPercent: total > 0 ? Math.round(((total - idle) / total) * 100) : null,
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    memoryMB: { total: Math.round(kb("MemTotal")), available: Math.round(kb("MemAvailable")), swapUsed: Math.round(kb("SwapTotal") - kb("SwapFree")) },
    webContainerMB: cg ? Math.round(Number(cg) / 1048576) : null,
    webProcessMB: Math.round(process.memoryUsage().rss / 1048576),
    uptimeHours: Math.round(os.uptime() / 360) / 10,
    live: await getLiveState(),
  });
}
