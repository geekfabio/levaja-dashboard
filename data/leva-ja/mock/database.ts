import { luandaDay } from "@/lib/format";
import { hasPermission } from "@/lib/leva-ja/permissions";
import type { AdminPermission } from "@/lib/leva-ja/permissions";
import type { AdminSession, AuditAction, AuditChange, AuditEntityKind, AuditLogEntry } from "@/types/leva-ja";
import type { RealtimeEvent, RealtimeListener, RealtimeTopic, Unsubscribe } from "../repositories/common";
import type { DemoSettings } from "../repositories/demo";
import { RepositoryError } from "../repositories/errors";
import { DAY, isoAt } from "./domain";
import { DEFAULT_SEED, generateSeed } from "./seed";
import { MOCK_STATE_VERSION } from "./state";
import type { MockState } from "./state";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type MockDatabaseOptions = {
  now?: () => Date;
  latencyMs?: number;
  failureRate?: number;
  storage?: StorageLike | null;
  seed?: number;
  tickMs?: number;
  random?: () => number;
};

export type MockContext = {
  state: MockState;
  session: AdminSession;
  now: Date;
  nowIso: string;
  today: string;
};

type Access = { permission?: AdminPermission | AdminPermission[]; anyOf?: AdminPermission[] };

type Ticker = (db: MockDatabase) => void;

export const STATE_STORAGE_KEY = "levaja.admin.mock.v1";
export const SESSION_STORAGE_KEY = "levaja.admin.session.v1";

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function shiftTimestamps<T>(value: T, deltaMs: number): T {
  if (typeof value === "string") {
    return (ISO_TIMESTAMP.test(value) ? new Date(new Date(value).getTime() + deltaMs).toISOString() : value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => shiftTimestamps(item, deltaMs)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = shiftTimestamps(item, deltaMs);
    return result as T;
  }
  return value;
}

function dayDistance(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / DAY);
}

export class MockDatabase {
  state: MockState;
  session: AdminSession | null;
  settings: DemoSettings;
  clock: () => Date;
  random: () => number;
  storage: StorageLike | null;
  seed: number;
  tickMs: number;
  ticker: Ticker | null;
  listeners: Set<{ topic: RealtimeTopic; listener: RealtimeListener }>;
  timer: ReturnType<typeof setInterval> | null;
  saveTimer: ReturnType<typeof setTimeout> | null;

  constructor(options: MockDatabaseOptions = {}) {
    this.clock = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.storage = options.storage ?? null;
    this.seed = options.seed ?? DEFAULT_SEED;
    this.tickMs = options.tickMs ?? 4000;
    this.settings = { latencyMs: options.latencyMs ?? 300, failureRate: options.failureRate ?? 0 };
    this.listeners = new Set();
    this.timer = null;
    this.saveTimer = null;
    this.ticker = null;
    this.state = this.load() ?? generateSeed(this.clock(), this.seed);
    this.session = this.loadSession();
  }

  now() {
    return this.clock();
  }

  today() {
    return luandaDay(this.clock());
  }

  load(): MockState | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MockState;
      if (parsed.version !== MOCK_STATE_VERSION) return null;
      const days = dayDistance(luandaDay(parsed.savedAt), this.today());
      return days > 0 ? shiftTimestamps(parsed, days * DAY) : parsed;
    } catch {
      return null;
    }
  }

  loadSession(): AdminSession | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AdminSession;
      return new Date(session.expiresAt).getTime() > this.clock().getTime() ? session : null;
    } catch {
      return null;
    }
  }

  saveSession() {
    if (!this.storage) return;
    try {
      if (this.session) this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
      else this.storage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }

  persist() {
    if (!this.storage || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 400);
  }

  flush() {
    if (!this.storage) return;
    try {
      this.state.savedAt = isoAt(this.clock().getTime());
      this.storage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  configure(settings: Partial<DemoSettings>) {
    this.settings = {
      latencyMs: Math.max(0, settings.latencyMs ?? this.settings.latencyMs),
      failureRate: Math.min(1, Math.max(0, settings.failureRate ?? this.settings.failureRate)),
    };
  }

  reset() {
    this.state = generateSeed(this.clock(), this.seed);
    this.flush();
    this.emit("all");
  }

  async delay() {
    if (this.settings.latencyMs > 0) {
      const jitter = this.settings.latencyMs * (0.7 + this.random() * 0.6);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
    if (this.settings.failureRate > 0 && this.random() < this.settings.failureRate) {
      throw new RepositoryError("network", "Falha de rede simulada. Tente novamente.");
    }
  }

  requireSession(): AdminSession {
    const session = this.session;
    if (!session || new Date(session.expiresAt).getTime() <= this.clock().getTime()) {
      throw new RepositoryError("unauthorized", "Inicie sessão para continuar.");
    }
    const user = this.state.adminUsers.find((item) => item.id === session.user.id);
    if (!user || !user.active) {
      throw new RepositoryError("unauthorized", "A sua conta foi desactivada.");
    }
    if (this.state.adminSessions?.some((record) => record.id === session.token && record.revokedAt)) {
      throw new RepositoryError("unauthorized", "A sua sessão foi terminada. Inicie sessão outra vez.");
    }
    if (user.role !== session.user.role) session.user = { ...user };
    session.rolePermissions = this.state.rolePermissions;
    return session;
  }

  context(session: AdminSession): MockContext {
    const now = this.clock();
    return { state: this.state, session, now, nowIso: now.toISOString(), today: luandaDay(now) };
  }

  async open<T>(fn: () => T): Promise<T> {
    await this.delay();
    return structuredClone(fn());
  }

  async run<T>(access: Access, fn: (ctx: MockContext) => T): Promise<T> {
    await this.delay();
    const session = this.requireSession();
    const required = access.permission ? (Array.isArray(access.permission) ? access.permission : [access.permission]) : [];
    const matrix = this.state.rolePermissions;
    const missing = required.some((permission) => !hasPermission(session.user.role, permission, matrix));
    const anyMissing = access.anyOf ? !access.anyOf.some((permission) => hasPermission(session.user.role, permission, matrix)) : false;
    if (missing || anyMissing) {
      throw new RepositoryError("forbidden", "O seu papel não tem permissão para esta acção.");
    }
    return structuredClone(fn(this.context(session)));
  }

  nextId(prefix: string) {
    this.state.sequence += 1;
    return `${prefix}-${this.state.sequence}`;
  }

  audit(
    ctx: MockContext,
    action: AuditAction,
    entity: { kind: AuditEntityKind; id: string; label: string },
    reason?: string,
    changes?: AuditChange[],
  ) {
    const entry: AuditLogEntry = {
      id: this.nextId("aud"),
      actorId: ctx.session.user.id,
      actorName: ctx.session.user.name,
      actorRole: ctx.session.user.role,
      action,
      entity,
      reason: reason?.trim() || undefined,
      changes: changes?.length ? changes : undefined,
      at: ctx.nowIso,
    };
    this.state.audit.unshift(entry);
    return entry;
  }

  commit(...topics: RealtimeEvent["topic"][]) {
    this.persist();
    for (const topic of new Set([...topics, "audit" as const])) this.emit(topic);
  }

  emit(topic: RealtimeEvent["topic"] | "all") {
    const at = this.clock().toISOString();
    const topics: RealtimeEvent["topic"][] =
      topic === "all" ? ["requests", "providers", "support", "documents", "finance", "audit"] : [topic];
    for (const { topic: wanted, listener } of [...this.listeners]) {
      for (const current of topics) {
        if (wanted === "all" || wanted === current) listener({ topic: current, at });
      }
    }
  }

  setTicker(ticker: Ticker) {
    this.ticker = ticker;
  }

  subscribe(topic: RealtimeTopic, listener: RealtimeListener): Unsubscribe {
    const entry = { topic, listener };
    this.listeners.add(entry);
    this.startTicker();
    return () => {
      this.listeners.delete(entry);
      if (this.listeners.size === 0) this.stopTicker();
    };
  }

  startTicker() {
    if (this.timer || !this.ticker || this.tickMs <= 0) return;
    this.timer = setInterval(() => this.ticker?.(this), this.tickMs);
  }

  stopTicker() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
