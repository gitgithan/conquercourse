// A short one-way code for an address or a browser session, so a table can say "the same player" without holding either (CC-108, CC-221).
export async function playerCode(raw: string, salt = 'cc-lift'): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${raw}`));
  return [...new Uint8Array(d).slice(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
