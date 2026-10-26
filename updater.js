// Self-update: every 5 minutes, look for a newer commit on GitHub (wood29/stg-heating, main).
// If there is one, download it, swap in the new web files and server, and restart.
// Docker's restart policy brings the container straight back up on the new code.
// Turn off with AUTO_UPDATE=0. Recreating the container resets to the image (which is never older).
import { readFile, writeFile, mkdir, rm, rename, cp } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import path from "node:path";

const REPO = "wood29/stg-heating";
const EVERY = 5 * 60 * 1000;

export function startUpdater(appDir, log = console.log) {
  if (process.env.AUTO_UPDATE === "0") return;
  const versionFile = path.join(appDir, "VERSION");
  const check = async () => {
    try {
      const have = (await readFile(versionFile, "utf8").catch(() => "")).trim();
      const r = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
        headers: { Accept: "application/vnd.github.sha", "User-Agent": "seewaerme" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) return;
      const want = (await r.text()).trim();
      if (!/^[0-9a-f]{40}$/.test(want) || want === have) return;
      log(`Update available: ${have.slice(0, 7) || "unknown"} → ${want.slice(0, 7)}`);
      const t = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${want}`, { signal: AbortSignal.timeout(120000) });
      if (!t.ok) return log(`Update download failed (HTTP ${t.status})`);
      const files = untar(gunzipSync(Buffer.from(await t.arrayBuffer())));
      const keep = Object.entries(files).filter(([p]) => /^public\//.test(p) || /^[a-z0-9_-]+\.js$/i.test(p));
      if (!keep.some(([p]) => p === "server.js") || !keep.some(([p]) => p === "public/index.html")) return log("Update skipped: download looks incomplete");
      const stage = path.join(appDir, ".next");
      await rm(stage, { recursive: true, force: true });
      for (const [p, data] of keep) { const f = path.join(stage, p); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, data); }
      // never install a server that doesn't even parse
      const ok = await new Promise(res => execFile(process.execPath, ["--check", path.join(stage, "server.js")], e => res(!e)));
      if (!ok) { await rm(stage, { recursive: true, force: true }); return log("Update skipped: new server.js has a syntax error"); }
      await rm(path.join(appDir, ".old"), { recursive: true, force: true });
      await rename(path.join(appDir, "public"), path.join(appDir, ".old"));
      await rename(path.join(stage, "public"), path.join(appDir, "public"));
      for (const [p] of keep) if (!p.startsWith("public/")) await cp(path.join(stage, p), path.join(appDir, p));
      await writeFile(versionFile, want + "\n");
      await rm(stage, { recursive: true, force: true }); await rm(path.join(appDir, ".old"), { recursive: true, force: true });
      log(`Updated to ${want.slice(0, 7)}; restarting`);
      setTimeout(() => process.exit(3), 500);
    } catch (e) { log(`Update check failed: ${e.message}`); }
  };
  setTimeout(check, 60 * 1000);
  setInterval(check, EVERY).unref();
}

// minimal tar reader (ustar + pax path headers), enough for GitHub's source tarballs
function untar(buf) {
  const out = {}; let off = 0, paxPath = null;
  const str = (o, n) => buf.toString("utf8", o, o + n).replace(/\0.*$/s, "");
  while (off + 512 <= buf.length) {
    if (buf[off] === 0) break;
    const name = str(off, 100), size = parseInt(str(off + 124, 12).trim() || "0", 8), type = String.fromCharCode(buf[off + 156] || 48);
    const prefix = str(off + 345, 155), body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") { const m = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8")); paxPath = m ? m[1] : null; continue; }
    if (type === "g") continue;
    const full = paxPath || (prefix ? `${prefix}/${name}` : name); paxPath = null;
    if (type !== "0" && type !== "\0") continue;
    const rel = full.split("/").slice(1).join("/");   // drop "stg-heating-<sha>/"
    if (rel && !rel.includes("..")) out[rel] = body;
  }
  return out;
}
