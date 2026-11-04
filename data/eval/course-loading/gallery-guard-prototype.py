from pathlib import Path
p=Path('src/modes/course.ts'); s=p.read_text()
old='  { let heldBefore = false; window.addEventListener(GALLERY_EVENT, (ev) => { if ((ev as CustomEvent).detail.open)'
new='  let profileGalleryOpen = false;\n  { let heldBefore = false; window.addEventListener(GALLERY_EVENT, (ev) => { profileGalleryOpen = (ev as CustomEvent).detail.open; if ((ev as CustomEvent).detail.open)'
assert old in s
s=s.replace(old,new,1).replace('  function frame(now: number, stepped = false) {','  function frame(now: number, stepped = false) {\n    if (profileGalleryOpen) { requestAnimationFrame(frame); return; }',1)
p.write_text(s)
