// One look for everything the game writes over the picture (CC-156): bright text on a dark, slightly see-through panel,
// so it reads on a bright sky, a dark tunnel and grass alike. ?hud=old brings back the black text with a light shadow.

export const HUD = {
  panel: 'rgba(14,18,26,0.84)',
  panelSolid: '#0e121a',
  text: '#f4f7f1',
  soft: '#cfd8d2',
  border: 'rgba(255,255,255,0.22)',
  track: 'rgba(255,255,255,0.2)',
  mark: '#ffb347',
} as const;

export const hudOn = (params: URLSearchParams): boolean => params.get('hud') !== 'old';

/** The panel as CSS: radius, padding and border included. */
export const panelCss = (pad = '6px 10px'): string => `background:${HUD.panel};color:${HUD.text};border:1px solid ${HUD.border};border-radius:12px;padding:${pad};text-shadow:none;box-shadow:0 2px 10px #0006`;

/** A key cap: bright letters on a dark rounded chip with a thicker bottom edge. */
export const keycapCss = 'display:inline-block;font:700 13px ui-monospace,monospace;background:#232a36;color:#f4f7f1;border:1px solid rgba(255,255,255,0.35);border-bottom-width:3px;border-radius:7px;padding:1px 7px;text-align:center;white-space:nowrap';

function lum(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio of two colours written as #rrggbb. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The panel colour (#rrggbb) once it sits over a background colour: alpha is 0.84 of the panel colour. */
export function panelOver(bg: string, alpha = 0.84, panel = HUD.panelSolid): string {
  const p = parseInt(panel.slice(1), 16), q = parseInt(bg.slice(1), 16);
  const mix = (s: number) => Math.round(alpha * ((p >> s) & 255) + (1 - alpha) * ((q >> s) & 255));
  return `#${[16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('')}`;
}

/** The worst case for the text: the panel over pure white (a bright sky) is the lightest it can get. */
export const worstContrast = (text: string = HUD.text): number => contrastRatio(text, panelOver('#ffffff'));
