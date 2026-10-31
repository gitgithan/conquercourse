// What a player may type to make a character, and the placeholder safety check (CC-108). Pure.
export const PROMPT_MIN = 3;
export const PROMPT_MAX = 140;
// Plain-words rules shown on the page: no real people, no children, no weapons. This list is a first filter, not the safety check; the Muse Spark Open check runs after it when it is switched on.
const BLOCKED = /\b(gun|rifle|pistol|knife|sword|bomb|weapon|nude|naked|sex|porn|gore|kill|child|children|kid|baby|toddler|boy|girl|minor|teen|trump|biden|putin|obama)s?\b/i;

export const cleanPrompt = (raw: unknown): string => String(raw ?? '').replace(/[\u0000-\u001f<>{}`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PROMPT_MAX);
export const promptKey = (p: string): string => p.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** '' when fine, else a plain sentence for the player. */
export function promptProblem(p: string): string {
  if (p.length < PROMPT_MIN) return 'Describe your character in a few words.';
  if (BLOCKED.test(p)) return 'No real people, no children and no weapons, please. Try another idea.';
  return '';
}

/** The short name on a card: the first words of the prompt. */
export const cardName = (p: string): string => { const w = p.replace(/^(an?|the)\s+/i, '').split(' ').slice(0, 5).join(' '); return (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 40); };
