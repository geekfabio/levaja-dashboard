function camelToSnakeKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
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

export function deepSnakeToCamel<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => deepSnakeToCamel(item)) as T;
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[snakeToCamelKey(key)] = deepSnakeToCamel(item);
    }
    return result as T;
  }
  return value as T;
}
