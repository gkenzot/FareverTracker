import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

function curlCffi(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python",
      ["-c", "from curl_cffi import requests; import sys; r=requests.get(sys.argv[1], impersonate='chrome', timeout=30); sys.stdout.buffer.write(r.content)", url],
      { windowsHide: true }
    );
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `exit ${code}`));
        return;
      }
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    });
  });
}

function materialize(pool, index, seen = new Map()) {
  const value = pool[index];
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(index)) {
    return seen.get(index);
  }
  if (Array.isArray(value)) {
    const array = [];
    seen.set(index, array);
    for (const itemIndex of value) {
      array.push(typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex);
    }
    return array;
  }
  const object = {};
  seen.set(index, object);
  for (const [key, itemIndex] of Object.entries(value)) {
    object[key] = typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex;
  }
  return object;
}

function decodeEntry(payload) {
  for (const node of payload.nodes || []) {
    if (node?.type === "data" && Array.isArray(node.data)) {
      const value = materialize(node.data, 0);
      if (value?.entry) {
        return value.entry;
      }
    }
  }
  return null;
}

const slugs = ["ponogian-crab", "niflelian-crab", "irritable-nightdog"];
for (const slug of slugs) {
  const payload = await curlCffi(`https://metaforge.app/farever/database/mounts/${slug}/__data.json`);
  const entry = decodeEntry(payload);
  const summary = {
    name: entry?.name,
    availability_note: entry?.availability_note,
    obtained_from: entry?.obtained_from,
    dropped_by: (entry?.dropped_by || []).map((drop) => ({
      unit_name: drop.unit_name,
      drop_percent: drop.drop_percent,
      source_kind: drop.source_kind
    })),
    chest_sources: entry?.chest_sources,
    shop_sources: entry?.shop_sources
  };
  console.log(`\n==== ${slug} ====`);
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(`_ls_tmp/${slug}-entry.json`, JSON.stringify(entry, null, 2));
}
