// GET /api/community-image?id=N: the photo of an approved community course, as a jpeg.
interface Env { DB: { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } } }

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return new Response('not found', { status: 404 });
  const row = await env.DB.prepare("SELECT image FROM community WHERE id = ? AND status = 'approved' AND reports < 3").bind(id).first<{ image: string }>();
  const b64 = row?.image.replace(/^data:image\/jpeg;base64,/, '');
  if (!b64) return new Response('not found', { status: 404 });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } });
};
