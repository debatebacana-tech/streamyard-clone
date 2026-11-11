// Build step: an update never gets built while a program is on air. The
// server has 2 vCPUs, and building the app next to the live Egress made the
// stream and the studio stutter. Waits (up to 5 h) until no program is live.
const base = process.argv[2];
if (!base || base.includes("undefined") || base.endsWith("//")) process.exit(0);
const deadline = Date.now() + 5 * 3600 * 1000;
while (Date.now() < deadline) {
  let live = false;
  try {
    const res = await fetch(`${base}/api/onair`, { signal: AbortSignal.timeout(8000) });
    live = res.ok && (await res.json()).live === true;
  } catch {
    live = false;
  }
  if (!live) process.exit(0);
  console.log(`${new Date().toISOString()} programa no ar: atualização espera a transmissão acabar`);
  await new Promise((r) => setTimeout(r, 60_000));
}
