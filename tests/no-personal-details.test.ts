import { expect, it } from 'vitest';
// @ts-expect-error plain .mjs script
import { findings } from '../scripts/check-personal.mjs';

it('no tracked file holds a real email address, a home folder path or a public IP (run `node scripts/check-personal.mjs`)', () => {
  expect(findings()).toEqual([]);
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain .mjs script
import { exifFlags } from '../scripts/check-personal.mjs';

const AT = '@';

function jpegWithTag(tag: number): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(tag, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(body.length + 2, 4);
  return Buffer.concat([head, body, Buffer.from([0xff, 0xda])]);
}

it('the check catches what the old one missed: IPv6, an email in a long line, GPS and serial numbers in pictures, an email inside a binary', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pd-'));
  const files = {
    v6: ['a.txt', `host ${['2a02', '6b8', '0', '1'].join(':')}::5 ok\n`],
    long: ['b.json', `{"x":"${'k'.repeat(400)} someone.real${AT}gmail.com ${'k'.repeat(10)}"}\n`],
    bin: ['c.bin', Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(` real.person${AT}gmail.com `), Buffer.from([0])])],
    docIp6: ['d.txt', 'doc 2001:db8::1 and ::1 and 12:30:45\n'],
  } as const;
  const paths = Object.values(files).map(([n, c]) => { const p = join(dir, n); writeFileSync(p, c); return p; });
  const got = findings(paths).join('\n');
  expect(got).toMatch(/a\.txt:1 public IPv6/);
  expect(got).toMatch(/b\.json:1 email/);
  expect(got).toMatch(/c\.bin:\d+ email/);
  expect(got).not.toMatch(/d\.txt/);
  expect(exifFlags(jpegWithTag(0x8825))).toContain('GPS position');
  expect(exifFlags(jpegWithTag(0xa431))).toContain('camera serial number');
  expect(exifFlags(jpegWithTag(0x010f))).toEqual([]);
});
