// The JSON reply every route in functions/api/ sends. One copy, so a change to headers or errors is made once.
// A route that needs more headers passes them as `extra`: json(body, 200, CORS) or json(body, 429, { 'retry-after': '60' }).
export const CORS = { 'access-control-allow-origin': '*' } as const;
export const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });
