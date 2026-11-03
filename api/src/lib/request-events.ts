import { db } from "../db/client";
import { serviceRequestEvents } from "../db/schema/ops";
import { newId } from "./ids";
import type { RequestActor, ServiceRequestStatus } from "./request-state";

export async function recordRequestEvent(requestId: string, status: ServiceRequestStatus, actor: RequestActor, at: Date) {
  await db.insert(serviceRequestEvents).values({ id: newId("evt"), requestId, status, actor, at });
}
