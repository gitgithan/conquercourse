// A phone has no keyboard (CC-138): a challenge link opened there shows the run to beat and says how to play it.
export interface Pointing { coarse: boolean; hover: boolean }

/** True for a device whose main pointer is a finger and that cannot hover: a phone or a tablet without a keyboard. */
export const isPhoneWithoutKeyboard = (p: Pointing): boolean => p.coarse && !p.hover;

/** `?phone=1` pretends to be a phone (for checks), `?phone=0` never does; otherwise ask the browser. */
export function phoneMode(params: URLSearchParams, ask: () => Pointing): boolean {
  const forced = params.get('phone');
  if (forced === '1') return true;
  if (forced === '0') return false;
  return isPhoneWithoutKeyboard(ask());
}

export const browserPointing = (): Pointing => ({
  coarse: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  hover: typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches,
});

export const PHONE_WORDS = (time: string): string => `Watch the run to beat: ${time}. Play it on a computer to beat it.`;
