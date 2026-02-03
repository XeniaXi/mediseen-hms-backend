/**
 * Safely extract a string param from Express 5 req.params
 * Express 5 types params as string | string[] | undefined
 */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

/**
 * Safely extract a string from query params
 */
export function queryParam(value: string | string[] | undefined | Record<string, unknown>): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}
