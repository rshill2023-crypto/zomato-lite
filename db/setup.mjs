// db/setup.mjs — REBUILD the database from the blueprint (db/schema.sql) and
// seed one restaurant + three reviews, spaced days apart so "latest" is real.
// Usage: npm run db:setup   (reads the secret from .env.local)
//
// DNS note: some IPv6-only/nat64 networks cannot resolve *.aws.neon.tech, so
// this script resolves the host via DNS-over-HTTPS (Cloudflare 1.1.1.1) when
// the normal lookup fails. Same trick as lib/neon.ts in the app.

import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { neon, neonConfig } from "@neondatabase/serverless";
import dns from "node:dns/promises";
import https from "node:https";

// --- load DATABASE_URL from .env.local (tiny env reader, no dependencies) ---
let DATABASE_URL;
try {
  const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  }
} catch {}
DATABASE_URL ??= process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("No DATABASE_URL found in .env.local or environment.");
  process.exit(1);
}
const databaseUrl = new URL(DATABASE_URL);

// --- DNS resolution: normal first, DNS-over-HTTPS fallback, cached 55s ------
const ipCache = new Map();

async function lookupWithTimeout(host, ms = 1500) {
  try {
    const r = Promise.race([dns.lookup(host), delay(ms).then(() => null)]);
    const v = await r;
    return v ? v.address : null;
  } catch {
    return null;
  }
}

async function resolveIpByDoH(host) {
  try {
    const res = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" } }
    );
    const data = await res.json();
    if (data.Status !== 0 || !data.Answer) return null;
    const ips = data.Answer.filter((a) => a.type === 1).map((a) => a.data);
    return ips.length ? ips[Math.floor(Date.now() / 60000) % ips.length] : null;
  } catch {
    return null;
  }
}

async function resolveIp(host) {
  const c = ipCache.get(host);
  if (c && c.expires > Date.now()) return c.ip;
  const ip = (await lookupWithTimeout(host)) ?? (await resolveIpByDoH(host));
  if (!ip) throw new Error(`Cannot resolve ${host} via DNS or DNS-over-HTTPS`);
  ipCache.set(host, { ip, expires: Date.now() + 55_000 });
  return ip;
}

function httpsViaIp(ip, host, options) {
  return new Promise((resolve, reject) => {
    const h = new Headers(options.headers);
    h.set("host", host);
    const headers = {};
    h.forEach((v, k) => (headers[k] = v));
    const req = https.request(
      { host: ip, port: 443, method: options.method ?? "GET", path: new URL(options.url ?? `https://${host}/sql`).pathname, headers, servername: host },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          resolve(
            new Response(text, {
              status: res.statusCode ?? 500,
              headers: { "content-type": res.headers["content-type"] ?? "text/plain" },
            })
          );
        });
      }
    );
    req.on("error", reject);
    if (typeof options.body === "string") req.end(options.body);
    else req.end();
  });
}

neonConfig.fetchFunction = async (input, options = {}) => {
  const url = typeof input === "string" ? new URL(input) : input;
  const ip = await resolveIp(url.hostname);
  return httpsViaIp(ip, url.hostname, { ...options, url: input });
};

const sql = neon(databaseUrl.toString());

async function main() {
  // Start clean in this dev script so re-running is easy.
  await sql`DROP TABLE IF EXISTS reviews`;
  await sql`DROP TABLE IF EXISTS restaurants`;

  // Apply the blueprint file exactly as written. The Neon HTTP driver runs one
  // statement per call, so split on the semicolons between CREATE TABLEs.
  const schemaSql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  for (const stmt of schemaSql.replace(/--.*$/gm, "").split(";")) {
    if (stmt.trim().length > 0) await sql.query(stmt.trim(), []);
  }
 // strip comments; send the CREATE TABLEs


  // Seed: one restaurant, three reviews on different days.
  const [restaurant] = await sql`
    INSERT INTO restaurants (name, cuisine, area)
    VALUES ('Ludhiana Burrito', 'Indian', 'Sector 32')
    RETURNING id
  `;

  const rid = restaurant.id;
  const seed = [
    [5, "Best burrito in Ludhiana, hands down.", "9 days"],
    [3, "Good food, but the wait was too long.", "4 days"],
    [4, "Solid taste. Slow service, great vibe.", "1 day"],
  ];
  for (const [rating, comment, when] of seed) {
    await sql`
      INSERT INTO reviews (restaurant_id, rating, comment, created_at)
      VALUES (${rid}, ${rating}, ${comment}, NOW() - (${when})::interval)
    `;
  }

  // Show what we made.
  const restaurants = await sql`SELECT * FROM restaurants ORDER BY id`;
  const reviews = await sql`SELECT id, rating, comment, created_at FROM reviews ORDER BY created_at`;
  console.log(JSON.stringify({ restaurants, reviews }, null, 2));
}

main().catch((err) => {
  console.error("db:setup failed:", err.message);
  process.exit(1);
});
