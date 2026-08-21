import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const url = "https://metaforge.app/farever/database/mounts/page/1/__data.json";
const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function sniff(label, buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
  const kind = text.startsWith("{") ? "json" : text.includes("Just a moment") ? "cf" : "other";
  console.log(label.padEnd(18), kind, `len=${text.length}`);
}

const direct = await execFileAsync(
  "curl.exe",
  [
    "-sS",
    "-L",
    "--compressed",
    "-A",
    ua,
    "-H",
    "Accept: application/json",
    "-H",
    "Referer: https://metaforge.app/farever/database/mounts",
    url
  ],
  { encoding: "buffer", maxBuffer: 10_000_000 }
);
sniff("node-curl", direct.stdout);

const viaPs = await execFileAsync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `curl.exe -sS -L --compressed -A '${ua}' -H 'Accept: application/json' -H 'Referer: https://metaforge.app/farever/database/mounts' '${url}'`
  ],
  { encoding: "buffer", maxBuffer: 10_000_000 }
);
sniff("node-ps-curl", viaPs.stdout);
