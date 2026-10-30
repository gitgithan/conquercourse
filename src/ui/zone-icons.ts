// One small outline picture per obstacle, drawn in a 32 by 32 box: the Course's obstacle strip and the end-of-run report use the same ones.
import { column } from '../course/obstacles';
export const ZONE_ICONS: Record<string, string> = column('icon'); // the pictures live in the obstacle rows (src/course/obstacles.ts)
