import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", "/index.ts"];

function withExtension(base) {
  if (existsSync(base) && path.extname(base)) return base;
  return extensions.map((extension) => base + extension).find((candidate) => existsSync(candidate));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = withExtension(path.join(root, specifier.slice(2)));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (!path.extname(base) || !existsSync(base)) {
      const file = withExtension(base);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
  }
  return nextResolve(specifier, context);
}
