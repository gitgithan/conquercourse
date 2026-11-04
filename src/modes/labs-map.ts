import { LAB_LIST } from '../ui/labs-series';

// CC-133: the old "Map of the Labs" page is now the Labs panel. Old links (?mode=labs-map) land on the first Lab with the panel open over it.
export function startLabsMap(_host: HTMLElement): { backend: 'canvas2d' } {
  const q = new URLSearchParams(location.search);
  const labs = q.get('labs') === '0' ? '0' : '1';
  location.replace(`?mode=${LAB_LIST[0].mode}&labs=${labs}&welcome=0&panel=1`);
  return { backend: 'canvas2d' };
}
