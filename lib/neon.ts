// lib/neon.ts — the ONLY place in the app that knows how to reach Postgres.
// Exposes getSql(): a raw-SQL runner. No ORM. You will see AVG(rating) with
// your own eyes in the API files.
//
// Workaround worth knowing: some networks (IPv6-only NAT64, like this Mac's)
// cannot resolve Neon's *.aws.neon.tech hostnames. So: resolve the host once
// (normal DNS first, DNS-over-HTTPS as fallback), then send the HTTPS request
// to that IP while keeping the real hostname for TLS. Cached for ~55 seconds.

import { neon, neonConfig } from "@neondatabase/serverless";
import dns from "node:dns/promises";
import https from "node:https";

const ipCache = new Map<string, { ip: string; expires: number }>();

// Try the operating system's own DNS, but give up quickly if it doesn't know.
function lookupWithTimeout(host: string, ms: number): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (!done) resolve(v);
      done = true;
    };
    const t = setTimeout(() => finish(null), ms);
    dns
      .lookup(host)
      .then((r) => finish(r.address))
      .catch(() => finish(null))
      .finally(() => clearTimeout(t));
  });
}

// Fallback: ask Cloudflare's public resolver over HTTPS ("where is this name?").
async function resolveIpByDoH(host: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" } }
    );
    const data = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ type: number; data: string }>;
    };
    if (data.Status !== 0 || !data.Answer) return null;
    const ips = data.Answer.filter((a) => a.type === 1).map((a) => a.data);
    if (ips.length === 0) return null;
    return ips[new Date().getMinutes() % ips.length];
  } catch {
    return null;
  }
}

async function resolveIp(host: string): Promise<string> {
  const cached = ipCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.ip;
  const ip = (await lookupWithTimeout(host, 1500)) ?? (await resolveIpByDoH(host));
  if (!ip) throw new Error(`Cannot resolve ${host} via DNS or DNS-over-HTTPS`);
  ipCache.set(host, { ip, expires: Date.now() + 55_000 });
  return ip;
}

// Make the actual HTTPS request ourselves: connect to the IP directly, but
// keep the real hostname for TLS (SNI) and for the HTTP Host header.
function httpsViaIp(ip: string, input: URL, options: { method?: string; headers?: HeadersInit; body?: string | ArrayBuffer | null }): Promise<Response> {
  return new Promise((resolve, reject) => {
    const h = new Headers(options.headers);
    h.set("host", input.hostname);
    const headers: Record<string, string> = {};
    h.forEach((v, k) => (headers[k] = v));
    const req = https.request(
      { host: ip, port: 443, method: options.method ?? "GET", path: input.pathname + input.search, headers, servername: input.hostname },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode ?? 500,
              headers: { "content-type": res.headers["content-type"] ?? "text/plain" },
            })
          );
        });
      }
    );
    req.on("error", reject);
    const body = options.body;
    if (typeof body === "string") req.end(body);
    else if (body instanceof ArrayBuffer) req.end(Buffer.from(body));
    else req.end();
  });
}

neonConfig.fetchFunction = async (input: string | URL, options: { method?: string; headers?: HeadersInit; body?: string | ArrayBuffer | null } = {}) => {
  const url = typeof input === "string" ? new URL(input) : input;
  const ip = await resolveIp(url.hostname);
  return httpsViaIp(ip, url, options);
};

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
