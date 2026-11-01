import { writeFileSync } from 'node:fs';
const B=process.env.FILM_CLIPS_A ?? 'clips/', C=process.env.FILM_CLIPS_B ?? 'clips/';
const segs=[
 {file:B+'hook.mp4',n:144,cap:['A real run. In slow motion.',10,125]},
 {file:B+'h-vault.mp4',n:36,cap:['Run. Jump. Swing. Vault. Climb.',0,270]},
 {file:B+'h-drop.mp4',n:18},{file:B+'h-band.mp4',n:18},{file:B+'h-launch.mp4',n:18},{file:B+'h-rope.mp4',n:36},{file:B+'h-ball.mp4',n:18},{file:B+'h-coaster.mp4',n:18},{file:B+'h-drone.mp4',n:36},{file:B+'h-wall.mp4',n:36},{file:B+'h-hang.mp4',n:36},{file:B+'h-tramp.mp4',n:18},
 {file:C+'slicer.mp4',ss:3,n:72,cap:['1  World Slicer: pick a real place',6,66]},
 {file:C+'editor.mp4',ss:3,n:54,cap:['2  World Editor: fix the lane',6,48]},
 {file:C+'community.mp4',ss:0,n:90,cap:['3  Community: play real courses',6,84]},
 {file:B+'rot.mp4',ss:28,n:90,cap:['4  Courses: side view to first person',6,84]},
 {file:B+'l-coaster.mp4',n:90,cap:['Coaster. Drone. Rope. Trampoline.',6,480]},
 {file:B+'l-vault.mp4',n:54},{file:B+'l-drone.mp4',n:72},{file:B+'l-wall.mp4',n:54},{file:B+'l-launch.mp4',n:54},{file:B+'l-hang.mp4',n:54},{file:B+'l-rope.mp4',n:54},{file:B+'l-tramp.mp4',n:54},
 {file:B+'dojo.mp4',ss:12,n:54,cap:['The Dojo: learn by playing',6,48]},
 {file:C+'lab.mp4',ss:0,n:90,cap:['Labs: drag the bar, watch the arm',6,84]},
 {file:B+'group.mp4',n:72},
 {file:B+'group-last.png',still:true,n:108},
 {file:B+'logo.png',still:true,n:216,fade:36}
];
const tl={fps:30,music:{file:process.env.FILM_MUSIC ?? '../conquercourse-assets/demo-media/music/film-owner-cut.ogg',start:19.33,fadeOut:2},segments:segs};
writeFileSync(process.argv[2],JSON.stringify(tl,null,1));
const hail=segs.slice(1,9);
const short=[{file:B+'hook.mp4',n:90,cap:['A real run. In slow motion.',10,80]},...hail.map((x,i)=>i==0?{...x,cap:['Run. Jump. Swing. Vault. Climb.',0,198]}:x),{file:B+'group.mp4',n:72},{file:B+'group-last.png',still:true,n:36},{file:B+'logo.png',still:true,n:72,fade:18}];
writeFileSync(process.argv[3]||'/dev/null',JSON.stringify({...tl,music:{...tl.music,fadeOut:1.5},segments:short},null,1));
