import { pageQuery } from '../flags';
let navigate: ((href: string) => boolean) | null = null;
export const registerCourseNavigation = (handler: (href: string) => boolean): void => { navigate = handler; };
export function openCourseHref(href: string): void {
  if (!navigate?.(href)) {
    const url = new URL(href, location.href);
    if (pageQuery().get('courseswitch') === '0') url.searchParams.set('courseswitch', '0');
    location.href = url.href;
  }
}
