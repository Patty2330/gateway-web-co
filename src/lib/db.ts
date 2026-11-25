import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { addDaysIso, applyPurchase, dropMonitor } from "@/lib/purchase";
import { scanIsComplete } from "@/lib/scan-complete";
import type { LeadInput, Plan, ScanPayload, ScanRecord, Tier } from "@/lib/types";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue | undefined>;

interface Sql {
  get(sql: string, params?: SqlValue[]): Promise<Row | undefined>;
  all(sql: string, params?: SqlValue[]): Promise<Row[]>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    website_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    mode TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    score INTEGER,
    tier TEXT NOT NULL,
    email TEXT,
    stripe_session_id TEXT,
    stripe_subscription_id TEXT,
    next_run_at TEXT,
    previous_score INTEGER,
    payload TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    scan_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    business_name TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    to_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    scan_id TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'stored',
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    ip_hash TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (ip_hash, day)
  )`,
  `CREATE INDEX IF NOT EXISTS scans_cache ON scans (cache_key, created_at)`,
  `CREATE INDEX IF NOT EXISTS scans_ip ON scans (ip_hash, cache_key, created_at)`,
  `CREATE INDEX IF NOT EXISTS scans_monitor ON scans (tier, next_run_at)`,
  `CREATE INDEX IF NOT EXISTS scans_subscription ON scans (stripe_subscription_id)`,
];

function text(value: SqlValue | undefined): string {
  return value == null ? "" : String(value);
}

function nullable(value: SqlValue | undefined): string | null {
  return value == null || value === "" ? null : String(value);
}

function mapScan(row: Row): ScanRecord {
  const payload = JSON.parse(text(row.payload)) as ScanPayload;
  const complete = payload.complete ?? scanIsComplete(payload);
  return {
    id: text(row.id),
    businessName: text(row.business_name),
    category: text(row.category),
    city: text(row.city),
    state: text(row.state),
    websiteUrl: nullable(row.website_url),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    ipHash: text(row.ip_hash),
    mode: text(row.mode) === "live" ? "live" : "demo",
    cacheKey: text(row.cache_key),
    score: complete ? Number(row.score ?? payload.score ?? 0) : null,
    tier: (text(row.tier) || "free") as Tier,
    email: nullable(row.email),
    stripeSessionId: nullable(row.stripe_session_id),
    stripeSubscriptionId: nullable(row.stripe_subscription_id),
    nextRunAt: nullable(row.next_run_at),
    previousScore: row.previous_score == null ? null : Number(row.previous_score),
    payload,
  };
}

class Store {
  constructor(private readonly sql: Sql) {}

  async insertScan(scan: ScanRecord): Promise<void> {
    await this.sql.run(
      `INSERT INTO scans (
        id, business_name, category, city, state, website_url, created_at, updated_at,
        ip_hash, mode, cache_key, score, tier, email, stripe_session_id,
        stripe_subscription_id, next_run_at, previous_score, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scan.id,
        scan.businessName,
        scan.category,
        scan.city,
        scan.state,
        scan.websiteUrl,
        scan.createdAt,
        scan.updatedAt,
        scan.ipHash,
        scan.mode,
        scan.cacheKey,
        scan.score,
        scan.tier,
        scan.email,
        scan.stripeSessionId,
        scan.stripeSubscriptionId,
        scan.nextRunAt,
        scan.previousScore,
        JSON.stringify(scan.payload),
      ],
    );
  }

  async getScan(id: string): Promise<ScanRecord | null> {
    const row = await this.sql.get(`SELECT * FROM scans WHERE id = ?`, [id]);
    return row ? mapScan(row) : null;
  }

  async findRecentByIp(ipHash: string, cacheKey: string, sinceIso: string): Promise<ScanRecord | null> {
    const rows = await this.sql.all(
      `SELECT * FROM scans WHERE ip_hash = ? AND cache_key = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20`,
      [ipHash, cacheKey, sinceIso],
    );
    return rows.map(mapScan).find((scan) => scanIsComplete(scan.payload)) ?? null;
  }

  async findRecentCache(cacheKey: string, sinceIso: string): Promise<ScanRecord | null> {
    const rows = await this.sql.all(
      `SELECT * FROM scans WHERE cache_key = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20`,
      [cacheKey, sinceIso],
    );
    return rows.map(mapScan).find((scan) => scanIsComplete(scan.payload)) ?? null;
  }

  async markPaid(
    id: string,
    purchase: {
      plan: Plan;
      email: string | null;
      stripeSessionId: string | null;
      stripeSubscriptionId: string | null;
      now?: Date;
    },
  ): Promise<ScanRecord | null> {
    const current = await this.getScan(id);
    if (!current) return null;
    const tier = applyPurchase(current.tier, purchase.plan);
    const now = purchase.now ?? new Date();
    const nextRunAt =
      tier === "monitor" ? current.nextRunAt ?? addDaysIso(now, 30) : current.nextRunAt;
    await this.sql.run(
      `UPDATE scans
       SET tier = ?, email = ?, stripe_session_id = ?, stripe_subscription_id = ?, next_run_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        tier,
        purchase.email || current.email,
        purchase.stripeSessionId || current.stripeSessionId,
        purchase.stripeSubscriptionId || current.stripeSubscriptionId,
        nextRunAt,
        now.toISOString(),
        id,
      ],
    );
    return this.getScan(id);
  }

  async updateResults(
    id: string,
    payload: ScanPayload,
    update: { previousScore: number; nextRunAt: string; now?: Date },
  ): Promise<void> {
    const now = update.now ?? new Date();
    await this.sql.run(
      `UPDATE scans SET score = ?, payload = ?, previous_score = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
      [
        payload.score,
        JSON.stringify(payload),
        update.previousScore,
        update.nextRunAt,
        now.toISOString(),
        id,
      ],
    );
  }

  async dueMonitors(nowIso: string): Promise<ScanRecord[]> {
    const rows = await this.sql.all(
      `SELECT * FROM scans WHERE tier = 'monitor' AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT 20`,
      [nowIso],
    );
    return rows.map(mapScan);
  }

  async insertLead(id: string, lead: LeadInput, createdAt: string): Promise<void> {
    await this.sql.run(
      `INSERT INTO leads (id, scan_id, name, email, phone, business_name, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, lead.scanId, lead.name, lead.email, lead.phone, lead.businessName, lead.message, createdAt],
    );
  }

  async insertEmail(input: {
    id: string;
    to: string;
    subject: string;
    body: string;
    scanId: string | null;
    createdAt: string;
  }): Promise<void> {
    await this.sql.run(
      `INSERT INTO emails (id, to_address, subject, body, scan_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.to, input.subject, input.body, input.scanId, input.createdAt],
    );
  }

  async markEmail(id: string, status: "sent" | "failed", error: string | null): Promise<void> {
    await this.sql.run(`UPDATE emails SET status = ?, error = ? WHERE id = ?`, [status, error, id]);
  }

  async getEmail(id: string): Promise<{
    id: string;
    to: string;
    subject: string;
    body: string;
    status: string;
    error: string | null;
  } | null> {
    const row = await this.sql.get(`SELECT * FROM emails WHERE id = ?`, [id]);
    if (!row) return null;
    return {
      id: text(row.id),
      to: text(row.to_address),
      subject: text(row.subject),
      body: text(row.body),
      status: text(row.status) || "stored",
      error: row.error == null || row.error === "" ? null : String(row.error),
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.sql.get("SELECT 1 AS ok");
      return true;
    } catch {
      return false;
    }
  }

  async clearMonitor(subscriptionId: string): Promise<ScanRecord | null> {
    const row = await this.sql.get(
      `SELECT * FROM scans WHERE stripe_subscription_id = ? LIMIT 1`,
      [subscriptionId],
    );
    if (!row) return null;
    const current = mapScan(row);
    const now = new Date().toISOString();
    await this.sql.run(
      `UPDATE scans
       SET tier = ?, stripe_subscription_id = NULL, next_run_at = NULL, updated_at = ?
       WHERE id = ?`,
      [dropMonitor(current.tier), now, current.id],
    );
    return this.getScan(current.id);
  }

  async consumeRateLimit(ipHash: string, day: string): Promise<number> {
    const row = await this.sql.get(
      `INSERT INTO rate_limits (ip_hash, day, count) VALUES (?, ?, 1)
       ON CONFLICT(ip_hash, day) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [ipHash, day],
    );
    return Number(row?.count ?? 1);
  }

  /** Decrement today's count, but never below zero. Safe to call more than once. */
  async refundRateLimit(ipHash: string, day: string): Promise<number> {
    const row = await this.sql.get(
      `UPDATE rate_limits SET count = count - 1
       WHERE ip_hash = ? AND day = ? AND count > 0
       RETURNING count`,
      [ipHash, day],
    );
    if (row) return Number(row.count ?? 0);
    const existing = await this.sql.get(
      `SELECT count FROM rate_limits WHERE ip_hash = ? AND day = ?`,
      [ipHash, day],
    );
    return Number(existing?.count ?? 0);
  }
}

class SqliteSql implements Sql {
  constructor(private readonly db: DatabaseSync) {}

  async get(sql: string, params: SqlValue[] = []) {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }

  async all(sql: string, params: SqlValue[] = []) {
    return this.db.prepare(sql).all(...params) as Row[];
  }

  async run(sql: string, params: SqlValue[] = []) {
    this.db.prepare(sql).run(...params);
  }
}

class PostgresSql implements Sql {
  constructor(private readonly pool: import("pg").Pool) {}

  private convert(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  async get(sql: string, params: SqlValue[] = []) {
    const result = await this.pool.query(this.convert(sql), params);
    return result.rows[0] as Row | undefined;
  }

  async all(sql: string, params: SqlValue[] = []) {
    const result = await this.pool.query(this.convert(sql), params);
    return result.rows as Row[];
  }

  async run(sql: string, params: SqlValue[] = []) {
    await this.pool.query(this.convert(sql), params);
  }
}

async function initSql(sql: Sql) {
  for (const statement of SCHEMA) {
    await sql.run(statement);
  }
  // Older databases were created before status/error existed.
  for (const statement of [
    `ALTER TABLE emails ADD COLUMN status TEXT NOT NULL DEFAULT 'stored'`,
    `ALTER TABLE emails ADD COLUMN error TEXT`,
    `ALTER TABLE scans ALTER COLUMN score DROP NOT NULL`,
  ]) {
    try {
      await sql.run(statement);
    } catch {
      // The column is already there, or this engine cannot drop NOT NULL.
    }
  }
}

export function databaseType(databaseUrl?: string | null): "postgres" | "sqlite" {
  const url = databaseUrl === undefined ? process.env.DATABASE_URL || null : databaseUrl;
  if (url && /^postgres(ql)?:/i.test(url)) return "postgres";
  return "sqlite";
}

const MISSING_DATABASE_URL_WARNING =
  "DATABASE_URL is not set. This production process is using SQLite, which does not persist across deploys or multiple instances. Set DATABASE_URL to a Postgres database before going live.";

/** Warning for production processes that have no DATABASE_URL. Never includes the URL or credentials. */
export function missingDatabaseUrlWarning(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== "production") return null;
  if (env.DATABASE_URL?.trim()) return null;
  return MISSING_DATABASE_URL_WARNING;
}

const processFlags = globalThis as unknown as { __gatewayMissingDatabaseUrlLogged?: boolean };

export function logMissingDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.warn,
): void {
  const message = missingDatabaseUrlWarning(env);
  if (!message || processFlags.__gatewayMissingDatabaseUrlLogged) return;
  processFlags.__gatewayMissingDatabaseUrlLogged = true;
  log(message);
}

function sqliteFile(databaseUrl?: string | null): string {
  if (process.env.SQLITE_PATH && databaseUrl === undefined) return process.env.SQLITE_PATH;
  if (databaseUrl?.startsWith("file:")) return databaseUrl.slice("file:".length);
  return path.join(process.cwd(), "data", "visibility.db");
}

const PGSSL_OFF = new Set(["0", "off", "false", "disable", "no"]);

/** True for a Render internal Postgres host such as dpg-abc123-a (private network, self-signed TLS). */
export function isRenderInternalHost(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return /^dpg-[a-z0-9]+-[a-z]$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * TLS options for pg. Render internal URLs use self-signed certificates, so TLS stays on
 * (when PGSSL=require) but certificate verification is off for them. External hosts verify.
 */
export function pgSslConfig(
  databaseUrl: string,
  env: Partial<Record<string, string | undefined>> = process.env,
): { rejectUnauthorized: boolean } | undefined {
  const mode = (env.PGSSL || "").trim().toLowerCase();
  if (PGSSL_OFF.has(mode)) return undefined;
  const needsSsl =
    mode === "require" || mode === "no-verify" || /render\.com|sslmode=require/i.test(databaseUrl);
  if (!needsSsl) return undefined;
  const noVerifyFlag = (env.PGSSL_NO_VERIFY || "").trim().toLowerCase();
  const noVerify =
    noVerifyFlag === "1" ||
    noVerifyFlag === "true" ||
    mode === "no-verify" ||
    isRenderInternalHost(databaseUrl);
  return { rejectUnauthorized: !noVerify };
}

const URL_SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];

/**
 * pg lets ssl params in the URL replace the ssl object, which would turn certificate
 * checks back on for Render's self-signed internal hosts. Drop them for internal hosts only.
 */
export function pgConnectionString(databaseUrl: string): string {
  if (!isRenderInternalHost(databaseUrl)) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    if (!URL_SSL_PARAMS.some((key) => url.searchParams.has(key))) return databaseUrl;
    for (const key of URL_SSL_PARAMS) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

/** Default Postgres connect timeout. A bad database fails fast instead of hanging /api/health. */
export const PG_CONNECT_TIMEOUT_MS = 10_000;

/** A short, secret-free description of a database error for logs. Never includes the URL. */
export function describeDbError(error: unknown): string {
  const err = error as { code?: unknown; message?: unknown } | null;
  const code = err && typeof err.code === "string" ? err.code : "";
  let message = err && typeof err.message === "string" ? err.message : String(error);
  message = message.replace(/postgres(ql)?:\/\/\S+/gi, "[database url]").slice(0, 200);
  return code ? `${code}: ${message}` : message;
}

export async function createStore(options?: {
  databaseUrl?: string | null;
  sqlitePath?: string;
  /** Tests only: shorter Postgres connect timeout. Production uses PG_CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number;
}): Promise<Store> {
  logMissingDatabaseUrl();
  const databaseUrl =
    options && "databaseUrl" in options ? options.databaseUrl : process.env.DATABASE_URL || null;

  if (databaseUrl && /^postgres(ql)?:/i.test(databaseUrl)) {
    const pg = await import("pg");
    const pool = new pg.Pool({
      connectionString: pgConnectionString(databaseUrl),
      max: 5,
      // Fail fast instead of hanging the health check when the database is unreachable.
      connectionTimeoutMillis: options?.connectTimeoutMs ?? PG_CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      ssl: pgSslConfig(databaseUrl),
    });
    pool.on("error", (error) => console.error(`Postgres pool error: ${describeDbError(error)}`));

    const sql = new PostgresSql(pool);
    await initSql(sql);
    return new Store(sql);
  }

  const file = options?.sqlitePath || sqliteFile(options ? databaseUrl : undefined);
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  if (file !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA busy_timeout = 5000;");
  const sql = new SqliteSql(db);
  await initSql(sql);
  return new Store(sql);
}

const globalStore = globalThis as unknown as { __visibilityStore?: Promise<Store> };

/** Cache one store per process, but drop a failed attempt so the next call retries. */
export function cachedStore(factory: () => Promise<Store> = createStore): Promise<Store> {
  if (!globalStore.__visibilityStore) {
    const attempt = factory();
    globalStore.__visibilityStore = attempt;
    attempt.catch((error) => {
      if (globalStore.__visibilityStore === attempt) globalStore.__visibilityStore = undefined;
      console.error(`Database connection failed: ${describeDbError(error)}`);
    });
  }
  return globalStore.__visibilityStore;
}

export function resetStoreCacheForTests(): void {
  globalStore.__visibilityStore = undefined;
}

export function getStore(): Promise<Store> {
  return cachedStore();
}
