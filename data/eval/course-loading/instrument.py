from pathlib import Path
p=Path('src/main.ts');s=p.read_text();s='performance.mark("load:main-enter");\n'+s;s=s.replace("document.documentElement.dataset.ready = 'true';", "performance.mark('load:app-ready'); document.documentElement.dataset.ready = 'true';");p.write_text(s)
p=Path('src/modes/course.ts');s=p.read_text();s=s.replace('  const params = pageQuery();','  performance.mark("load:course-enter");\n  const params = pageQuery();',1)
s=s.replace('  await renderer.init();','  performance.mark("load:renderer-start"); await renderer.init(); performance.mark("load:renderer-end");',1)
s=s.replace('  const { camera, frontCam } = cam;', '  performance.mark("load:camera-end");\n  const { camera, frontCam } = cam;',1)
s=s.replace('  const built = buildCourseScene(scene, course, params);','  performance.mark("load:scene-start"); const built = buildCourseScene(scene, course, params); performance.mark("load:scene-end");',1)
s=s.replace('  await wear.start();','  performance.mark("load:runner-start"); await wear.start(); performance.mark("load:runner-end");',1)
s=s.replace('  ghostCtl.begin(', '  performance.mark("load:ghost-start");\n  ghostCtl.begin(',1)
s=s.replace('  st.last = performance.now();\n  let studioHold', '  performance.mark("load:ghost-end");\n  st.last = performance.now();\n  let studioHold',1)
needle='  requestAnimationFrame(frame);\n\n  const backend ='
assert needle in s
s=s.replace(needle,'  performance.mark("load:frame-scheduled");\n  requestAnimationFrame((time) => { performance.mark("load:first-frame-start"); frame(time); performance.mark("load:first-frame-end"); });\n\n  const backend =',1);p.write_text(s)
