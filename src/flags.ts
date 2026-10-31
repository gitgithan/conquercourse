// The one place that reads the page address (the "?word=value" switches).
// A new switch is read here (pageQuery() or pageSearch()), never with a raw location.search in another file; tests/flags.test.ts keeps that true.
// Pure helpers elsewhere (hudOn(params), shareOn(params), ...) take the params as an argument, so a test can pass any address.
export const pageSearch = (): string => (typeof location === 'undefined' ? '' : location.search);
export const pageQuery = (): URLSearchParams => new URLSearchParams(pageSearch());
export const flag = (name: string): string | null => pageQuery().get(name);
