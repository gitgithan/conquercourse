// Copy the full experiment trail back into data/eval/ (files git does not track).
import { cpSync, existsSync } from 'node:fs';
const src = process.argv[2] ?? '../conquercourse-assets/eval-full';
if (!existsSync(src)) {
  console.error(`No trail at ${src}. Pass its folder as the first argument.`);
  process.exit(1);
}
cpSync(src, 'data/eval', { recursive: true, force: false, errorOnExist: false });
console.log(`Restored ${src} into data/eval/ (existing files were kept).`);
