import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newId } from "./ids";

export const UPLOAD_CONTEXTS = ["cargo", "vehicle", "delivery", "document"] as const;
export type UploadContext = (typeof UPLOAD_CONTEXTS)[number];

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(currentDir, "../../uploads");

const VALID_ID = /^upl_[a-z0-9]+$/i;

type UploadMeta = { contentType: string; context: UploadContext };

function metaPath(id: string) {
  return path.join(UPLOADS_DIR, `${id}.json`);
}

function filePath(id: string) {
  return path.join(UPLOADS_DIR, id);
}

export async function saveUpload(buffer: Buffer, contentType: string, context: UploadContext) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const id = newId("upl");
  await writeFile(filePath(id), buffer);
  const meta: UploadMeta = { contentType, context };
  await writeFile(metaPath(id), JSON.stringify(meta), "utf8");
  return { id, contentType };
}

export async function readUpload(id: string) {
  if (!VALID_ID.test(id)) return null;
  try {
    const [buffer, rawMeta] = await Promise.all([readFile(filePath(id)), readFile(metaPath(id), "utf8")]);
    const meta = JSON.parse(rawMeta) as UploadMeta;
    return { buffer, contentType: meta.contentType };
  } catch {
    return null;
  }
}
