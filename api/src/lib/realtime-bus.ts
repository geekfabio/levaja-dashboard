import { EventEmitter } from "node:events";

/**
 * In-process "something changed" signal for the WebSocket channel
 * (src/routes/realtime.ts). It carries no data: each connection reacts by
 * re-reading its own subscriptions through the regular endpoints, so the
 * access rules stay in one place.
 *
 * Single process only — with more than one API instance, a change handled by
 * another instance is picked up by the periodic refresh instead.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function notifyRealtimeChange() {
  bus.emit("change");
}

export function onRealtimeChange(listener: () => void) {
  bus.on("change", listener);
  return () => {
    bus.off("change", listener);
  };
}
