import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TokenExpiredError, verifyAccessToken } from "../lib/jwt";
import { notifyRealtimeChange, onRealtimeChange } from "../lib/realtime-bus";

/**
 * Basic real-time channel for the mobile app (protocol in leva-ja/docs/api.md):
 *
 *   app → server   { type: "auth", token } · { type: "subscribe" | "unsubscribe", topic } · { type: "ping" }
 *   server → app   { type: "event", topic, data } · { type: "pong" } · { type: "error", code, message }
 *
 * Topics are the ones the app used to poll: "requests", "providers/<id>",
 * "threads/<id>". The server does that polling on the app's behalf, through
 * the very same endpoints (app.inject with the connection's token), so every
 * access rule is applied exactly once, by the endpoint. A refresh runs when
 * any request to the API changes something (see the onResponse hook) and on a
 * slow timer as a safety net.
 */
const REFRESH_DEBOUNCE_MS = 150;
const SAFETY_REFRESH_MS = 15_000;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WATCHED_PREFIXES = ["/requests", "/providers", "/threads", "/admin"];

const clientFrameSchema = z.union([
  z.object({ type: z.literal("auth"), token: z.string().min(1) }),
  z.object({ type: z.enum(["subscribe", "unsubscribe"]), topic: z.string().min(1) }),
  z.object({ type: z.literal("ping") }),
]);

type ServerFrame = { type: "event"; topic: string; data: unknown } | { type: "pong" } | { type: "error"; code: string; message: string };

type Subscription = { path: string; mode: "changes" | "value"; cursor?: string; last?: string; wrap: (item: unknown) => unknown };

function subscriptionFor(topic: string): Subscription | null {
  if (topic === "requests") return { path: "/requests/changes", mode: "changes", wrap: (item) => item };
  const [kind, id, ...rest] = topic.split("/");
  if (!id || rest.length > 0) return null;
  const safeId = encodeURIComponent(id);
  if (kind === "providers") return { path: `/providers/${safeId}/state`, mode: "value", wrap: (item) => item };
  if (kind === "threads") return { path: `/threads/${safeId}/changes`, mode: "changes", wrap: (message) => ({ type: "message", message }) };
  return null;
}

function affectsRealtime(method: string, url: string, statusCode: number) {
  if (!MUTATING_METHODS.has(method) || statusCode >= 400) return false;
  const path = url.split("?")[0] ?? "";
  // Position pings arrive every few seconds from every online provider and change no request.
  if (path.endsWith("/location")) return false;
  return WATCHED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function realtimeRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.addHook("onResponse", async (request, reply) => {
    if (affectsRealtime(request.method, request.url, reply.statusCode)) notifyRealtimeChange();
  });

  app.get("/realtime", { websocket: true }, (socket) => {
    let token: string | null = null;
    let closed = false;
    let refreshing = false;
    let refreshAgain = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const subscriptions = new Map<string, Subscription>();

    const send = (frame: ServerFrame) => {
      if (!closed) socket.send(JSON.stringify(frame));
    };

    const end = () => {
      if (closed) return;
      closed = true;
      clearTimeout(debounce);
      clearInterval(safety);
      offChange();
      socket.close();
    };

    /** Reads one subscription through its endpoint; returns false when the endpoint refused it. */
    const read = async (topic: string, subscription: Subscription, deliver: boolean) => {
      const query = subscription.mode === "changes" && subscription.cursor ? `?since=${encodeURIComponent(subscription.cursor)}` : "";
      const response = await app.inject({ method: "GET", url: `${subscription.path}${query}`, headers: { authorization: `Bearer ${token}` } });
      if (response.statusCode === 401) {
        send({ type: "error", code: "unauthorized", message: "Token inválido ou expirado." });
        end();
        return false;
      }
      if (response.statusCode >= 400) return false;

      const body = response.json() as { data: unknown; meta?: { cursor?: string } };
      if (subscription.mode === "changes") {
        const items = Array.isArray(body.data) ? body.data : [];
        // The first read only fixes the starting point, like the polling client did.
        if (deliver && subscription.cursor !== undefined) items.forEach((item) => send({ type: "event", topic, data: subscription.wrap(item) }));
        subscription.cursor = body.meta?.cursor ?? subscription.cursor;
        return true;
      }
      const serialized = JSON.stringify(body.data);
      if (deliver && subscription.last !== undefined && serialized !== subscription.last) send({ type: "event", topic, data: subscription.wrap(body.data) });
      subscription.last = serialized;
      return true;
    };

    const refresh = async () => {
      if (closed || !token) return;
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        for (const [topic, subscription] of subscriptions) {
          if (closed) break;
          await read(topic, subscription, true);
        }
      } catch (error) {
        app.log.warn({ err: error }, "realtime refresh failed");
      } finally {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          void refresh();
        }
      }
    };

    const scheduleRefresh = () => {
      if (closed || subscriptions.size === 0) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    };

    const offChange = onRealtimeChange(scheduleRefresh);
    const safety = setInterval(scheduleRefresh, SAFETY_REFRESH_MS);
    safety.unref();

    const handle = async (raw: string) => {
      let frame: z.infer<typeof clientFrameSchema>;
      try {
        frame = clientFrameSchema.parse(JSON.parse(raw));
      } catch {
        return send({ type: "error", code: "validation", message: "Mensagem inválida." });
      }

      if (frame.type === "ping") return send({ type: "pong" });

      if (frame.type === "auth") {
        try {
          await verifyAccessToken(frame.token);
        } catch (error) {
          send({ type: "error", code: "unauthorized", message: error instanceof TokenExpiredError ? "O token de acesso expirou." : "Token inválido." });
          return end();
        }
        token = frame.token;
        return;
      }

      if (!token) return send({ type: "error", code: "unauthorized", message: "Autentica a ligação primeiro." });

      if (frame.type === "unsubscribe") {
        subscriptions.delete(frame.topic);
        return;
      }

      if (subscriptions.has(frame.topic)) return;
      const subscription = subscriptionFor(frame.topic);
      if (!subscription) return send({ type: "error", code: "validation", message: `Tópico desconhecido: ${frame.topic}.` });
      // The first read doubles as the access check: the endpoint refuses what this account cannot see.
      const allowed = await read(frame.topic, subscription, false);
      if (closed) return;
      if (!allowed) return send({ type: "error", code: "forbidden", message: `Sem acesso ao tópico ${frame.topic}.` });
      subscriptions.set(frame.topic, subscription);
    };

    // Frames are handled one at a time, in order: "auth" must finish before the "subscribe" that follows it.
    let queue: Promise<unknown> = Promise.resolve();
    socket.on("message", (data: { toString(): string }) => {
      queue = queue.then(() => handle(data.toString())).catch((error) => app.log.warn({ err: error }, "realtime frame failed"));
    });
    socket.on("close", end);
    socket.on("error", end);
  });
}
