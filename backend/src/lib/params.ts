export function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}
