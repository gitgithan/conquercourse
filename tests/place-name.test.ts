import { describe, expect, it } from 'vitest';
import { MAX_NAME, nameFor, pinLabel, shortFromAddress, shortFromSearch } from '../src/world/place-name';
import type { ReadyIndexEntry } from '../src/world/places';

const ready = [{ slug: 'speicherstadt-hamburg', name: 'Speicherstadt', lat: 53.5435, lon: 9.9885 }] as ReadyIndexEntry[];
describe('a short name for the picked place', () => {
  it('a ready place keeps its own name', () => expect(nameFor(53.5436, 9.9886, ready, 'Somewhere else, Hamburg')).toBe('Speicherstadt'));
  it('a search hit becomes its first part', () => expect(nameFor(10, 10, ready, 'Piazza San Marco, San Marco, Venezia, Veneto, Italia')).toBe('Piazza San Marco'));
  it('the country code tells same-named places apart', () => {
    expect(nameFor(10, 10, ready, 'Sudbury, Suffolk, England', 'gb')).toBe('Sudbury (GB)');
    expect(shortFromSearch('Sudbury, Ontario, Canada', 'ca')).toBe('Sudbury (CA)');
    expect(shortFromAddress({ suburb: 'South Bank', municipality: 'Greater London', country_code: 'gb' })).toBe('South Bank, London (GB)');
  });
  it('no hint and no ready place means the caller asks the map', () => expect(nameFor(10, 10, ready)).toBeNull());
  it('an address gives the quarter and the town when it fits', () => expect(shortFromAddress({ suburb: 'Alfama', city: 'Lisboa' })).toBe('Alfama, Lisboa'));
  it('a long name is cut, never longer than the limit', () => {
    expect(shortFromAddress({ name: 'The Very Long Named Museum Of Everything Old', city: 'X' }).length).toBeLessThanOrEqual(MAX_NAME);
    expect(shortFromSearch('A'.repeat(60)).length).toBeLessThanOrEqual(MAX_NAME);
  });
  it('falls back to the town, then to the pin', () => {
    expect(shortFromAddress({ city: 'Bergen' })).toBe('Bergen');
    expect(shortFromAddress({})).toBe('');
    expect(pinLabel(41.39172, 2.16491)).toBe('Pin 41.392, 2.165');
  });
});
