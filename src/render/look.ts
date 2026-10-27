// The custom look (CC-41): a body made from MHR shape numbers, skinned to the Rookie's bones.
// Behind the feature switch ?look=custom (or ?look=<variant>, ?look=url:<path>); the default Rookies are unchanged.
export const LOOK_DIR = '/assets/experiments/mhr-look';

// '' or 'custom' -> the neutral body; 'tall', 'short', ... -> that variant; 'url:/x.glb' -> a GLB made from a photo
export function lookUrl(look: string): string {
  if (look.startsWith('url:')) return look.slice(4);
  const name = look === '' || look === 'custom' ? 'neutral' : look.replace(/[^a-z0-9-]/g, '');
  return `${LOOK_DIR}/mhr-${name}-t.glb`;
}

export function lookSwitchOn(search: string): string | null {
  const v = new URLSearchParams(search).get('look');
  return v === null ? null : v === '' ? 'custom' : v;
}
