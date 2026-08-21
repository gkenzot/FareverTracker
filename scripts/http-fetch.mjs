/**
 * Cloudflare blocks Node's TLS fingerprint on metaforge.app (HTTP 403).
 * Import scripts fetch that host through a Python curl_cffi worker that
 * impersonates Chrome. static.metaforge.app and Siagarta keep native fetch.
 *
 * Requires: pip install curl_cffi
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const WORKER_PATH = fileURLToPath(new URL("./metaforge-fetch.py", import.meta.url));
const META_FORGE_HOST = /^https:\/\/(?:www\.)?metaforge\.app\//i;

let worker = null;
let leftover = Buffer.alloc(0);
const waiters = [];
let queue = Promise.resolve();

function looksLikeCloudflareChallenge(body) {
  const head = body.subarray(0, 240).toString("utf8");
  return head.includes("Just a moment") || head.includes("cf-chl-");
}

function flushWaiters() {
  while (waiters.length > 0 && leftover.length >= waiters[0].minLength) {
    waiters.shift().resolve();
  }
}

function waitUntil(minLength) {
  if (leftover.length >= minLength) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    waiters.push({ minLength, resolve, reject });
  });
}

function ensureWorker() {
  if (worker && worker.exitCode == null) {
    return worker;
  }

  leftover = Buffer.alloc(0);
  waiters.length = 0;
  worker = spawn("python", ["-u", WORKER_PATH], {
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: true
  });
  worker.stdout.on("data", (chunk) => {
    leftover = Buffer.concat([leftover, chunk]);
    flushWaiters();
  });
  worker.on("exit", () => {
    worker = null;
    leftover = Buffer.alloc(0);
    while (waiters.length > 0) {
      waiters.shift().reject(new Error("MetaForge fetch worker closed"));
    }
  });
  return worker;
}

async function readBytes(size) {
  await waitUntil(size);
  const slice = leftover.subarray(0, size);
  leftover = leftover.subarray(size);
  return slice;
}

async function readLine() {
  while (true) {
    const newline = leftover.indexOf(0x0a);
    if (newline >= 0) {
      const line = leftover.subarray(0, newline).toString("ascii").replace(/\r$/, "");
      leftover = leftover.subarray(newline + 1);
      return line;
    }
    await waitUntil(leftover.length + 1);
  }
}

async function requestOnce(url) {
  const process = ensureWorker();
  process.stdin.write(`${url}\n`);
  const header = await readLine();
  const [statusText, lengthText] = header.split(" ");
  const status = Number(statusText);
  const length = Number(lengthText);
  if (!Number.isFinite(status) || !Number.isFinite(length) || length < 0) {
    throw new Error(`Bad MetaForge worker header: ${header}`);
  }
  const body = length > 0 ? await readBytes(length) : Buffer.alloc(0);
  return { status, body };
}

function pythonFetch(url) {
  const href = String(url);
  const run = async () => {
    let result = await requestOnce(href);
    if (result.status === 403 || looksLikeCloudflareChallenge(result.body)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      result = await requestOnce(href);
    }

    const challenged = result.status === 403 || looksLikeCloudflareChallenge(result.body);
    const status = challenged ? 403 : result.status;
    const body = result.body;
    return {
      ok: status >= 200 && status < 300 && !challenged,
      status,
      statusText: status >= 200 && status < 300 ? "OK" : String(status),
      headers: new Headers(),
      url: href,
      async arrayBuffer() {
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
      },
      async text() {
        return body.toString("utf8");
      },
      async json() {
        return JSON.parse(body.toString("utf8"));
      }
    };
  };
  queue = queue.then(run, run);
  return queue;
}

export function installCurlFetch() {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (url, options) => {
    if (META_FORGE_HOST.test(String(url))) {
      return pythonFetch(url);
    }
    return nativeFetch(url, options);
  };
}

export function closeMetaForgeFetch() {
  if (!worker) {
    return;
  }
  try {
    worker.stdin.end("QUIT\n");
  } catch {
    // Worker may already be gone.
  }
  worker.kill();
  worker = null;
}
