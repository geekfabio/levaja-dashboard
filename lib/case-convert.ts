function camelToSnakeKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export type SnakeToCamelOptions = { stripKz?: boolean };

function snakeToCamelKey(key: string, options: SnakeToCamelOptions) {
  const base = options.stripKz && key.length > 3 && key.endsWith("_kz") ? key.slice(0, -3) : key;
  return base.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function deepCamelToSnake<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => deepCamelToSnake(item)) as T;
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[camelToSnakeKey(key)] = deepCamelToSnake(item);
    }
    return result as T;
  }
  return value as T;
}

export function deepSnakeToCamel<T = unknown>(value: unknown, options: SnakeToCamelOptions = {}): T {
  if (Array.isArray(value)) return value.map((item) => deepSnakeToCamel(item, options)) as T;
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[snakeToCamelKey(key, options)] = deepSnakeToCamel(item, options);
    }
    return result as T;
  }
  return value as T;
}
