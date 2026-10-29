// The Dojo's look (CC-146): scoped under .dojo.v2 so ?dojo=old keeps the earlier layout. Same palette and type as the welcome card.
export const DOJO_V2_CSS = `
  .dojo.v2{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:none;width:100%;box-sizing:border-box;padding:0 clamp(12px,3vw,32px) 96px;gap:18px;display:flex;flex-direction:column;position:fixed;inset:0;overflow-y:auto;color:#2b2218;background:radial-gradient(1100px 560px at 15% -10%,#fff7e6 0%,#f7ecd4 52%,#efe0c2 100%)}
  .dojo.v2>*{max-width:1180px;width:100%;margin-inline:auto;box-sizing:border-box;flex:none}
  .dojo.v2 .bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;gap:12px;padding:12px 0;background:linear-gradient(#f7ecd4 72%,#f7ecd400)}
  .dojo.v2 .brand{display:grid;gap:4px}.dojo.v2 .kicker{font:700 12px/1 system-ui;letter-spacing:.18em;text-transform:uppercase;color:#8a5513}
  .dojo.v2 h1{margin:0;font:800 clamp(26px,4.4vw,38px)/1.05 system-ui,sans-serif;letter-spacing:-.04em;color:#2b2218}
  .dojo.v2 .hint{font:600 13px/1.2 system-ui;color:#7a6a52}
  .dojo.v2 #back{position:static!important;box-shadow:0 6px 16px #0f6b5c40!important;font-size:15px!important;padding:10px 18px!important;border-radius:999px;background:#0f6b5c;color:#fff;border:0;font-weight:800;white-space:nowrap}
  .dojo.v2 #back:hover{background:#13826f}
  .dojo.v2 .banner{background:#fff3d9;border:1px solid #e0b46a;color:#5a3d0a;border-radius:14px;padding:10px 14px}
  .dojo.v2 .cards{display:flex;flex-wrap:nowrap;gap:10px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
  .dojo.v2 .cards button{flex:0 0 auto;scroll-snap-align:start;display:grid;gap:2px;text-align:left;min-width:132px;padding:10px 14px;border-radius:14px;border:1px solid #e3d3b4;background:#fffaf0;color:#3b2f20;font-weight:700;transition:background .15s,border-color .15s}
  .dojo.v2 .cards button small{font-weight:500;font-size:12px;color:#7a6a52}
  .dojo.v2 .cards button:hover{background:#fff1d6}
  .dojo.v2 .cards button[aria-pressed=true]{background:#0f6b5c;color:#fffdf7;border-color:#0f6b5c;box-shadow:0 8px 20px #0f6b5c40}
  .dojo.v2 .cards button[aria-pressed=true] small{color:#d5efe6}
  .dojo.v2 .hero{display:grid;gap:10px;color:#2b2218}
  .dojo.v2 .hero h2{margin:0;font:800 clamp(24px,4vw,34px)/1.1 system-ui;letter-spacing:-.03em}
  .dojo.v2 .hero .q{margin:0;color:#5d4f3a;font-size:clamp(16px,2.2vw,19px)}
  .dojo.v2 .saying{font:italic 600 clamp(17px,2.4vw,21px)/1.35 Georgia,"Times New Roman",serif;color:#3b2a0c;border:0;border-left:5px solid #c9893b;background:#fbefd5;border-radius:12px;padding:12px 16px;box-shadow:0 4px 14px #8a551320}
  .dojo.v2 .saying.locked{font:500 15px/1.4 system-ui,sans-serif;font-style:normal;color:#7a6a52;background:#f3e6c9;border-left:5px dashed #c9893b99;box-shadow:none}
  .dojo.v2 .path{display:flex;align-items:flex-start;padding:2px 0}
  .dojo.v2 .path .node{flex:1 1 0;min-width:44px;display:grid;justify-items:center;gap:6px;position:relative;background:none;border:0;color:#7a6a52;font-size:12px;font-weight:600;padding:0 2px;text-align:center;cursor:pointer}
  .dojo.v2 .path .node::before{content:"";position:absolute;top:15px;left:-50%;width:100%;height:3px;background:#dccaa4;z-index:0}
  .dojo.v2 .path .node:first-child::before{display:none}
  .dojo.v2 .path .node.done::before,.dojo.v2 .path .node.on::before{background:#0f6b5c}
  .dojo.v2 .path .dot{position:relative;z-index:1;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:800 14px system-ui;background:#fffaf0;border:2px solid #cdb88e;color:#7a6a52}
  .dojo.v2 .path .done .dot{background:#0f6b5c;border-color:#0f6b5c;color:#fff}
  .dojo.v2 .path .on .dot{background:#fff;color:#0f6b5c;border-color:#c9893b;box-shadow:0 0 0 5px #c9893b33}
  .dojo.v2 .path .on{color:#2b2218}
  .dojo.v2 .row{gap:18px;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:start}.dojo.v2 .stage{position:sticky;top:84px}
  .dojo.v2 .stage,.dojo.v2 .panel,.dojo.v2 #diagram>div:last-child{background:#fffdf7;border:0;border-radius:20px;box-shadow:0 12px 34px #6b4e1f2e;padding:14px}
  .dojo.v2 .caption{margin-top:10px;padding:10px 14px;border-left:5px solid #c9893b;background:#fbefd5;border-radius:10px;color:#3b2a0c;font-size:15px;line-height:1.4}.dojo.v2 .caption.locked{background:#f3e6c9;border-left-style:dashed;color:#7a6a52}
  .dojo.v2 canvas{border:0;border-radius:12px;background:#fffdf7;display:block}
  .dojo.v2 .panel{padding:clamp(16px,2.4vw,24px);gap:12px}
  .dojo.v2 .panel>strong:first-child{font:800 20px/1.2 system-ui;letter-spacing:-.02em}
  .dojo.v2 label{font-weight:600}.dojo.v2 .why{font-weight:400}
  .dojo.v2 input[type=range]{accent-color:#0f6b5c;height:28px;cursor:pointer}
  .dojo.v2 .result{border-left:5px solid #0f6b5c;background:#e8f3ee;border-radius:10px;padding:10px 14px;font-weight:600}
  .dojo.v2 .formula{background:#2b2218;border-radius:14px;padding:16px;font-size:clamp(17px,2.6vw,24px);overflow-x:auto}
  .dojo.v2 .nav{display:flex;gap:10px;margin-top:6px}
  .dojo.v2 .nav button{flex:1 1 0;min-height:48px;border-radius:14px;font-size:16px;font-weight:700}
  .dojo.v2 .nav button.go{flex:2 1 0;box-shadow:0 8px 20px #0f6b5c55}
  .dojo.v2 .panel>a.btn{text-align:center;padding:14px;border-radius:14px;font-size:17px}
  .dojo.v2 button:focus-visible,.dojo.v2 a:focus-visible,.dojo.v2 input:focus-visible{outline:3px solid #b8741a;outline-offset:2px}
  @media(prefers-reduced-motion:no-preference){.dojo.v2 .stage,.dojo.v2 .panel,.dojo.v2 .hero{animation:dojoIn .28s ease-out both}}
  @keyframes dojoIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  @media(max-width:860px){.dojo.v2 .row{grid-template-columns:1fr}.dojo.v2 .stage{position:static}.dojo.v2 .path .node:last-child.on .t{right:0}.dojo.v2 .path .node:first-child.on .t{left:0}.dojo.v2 .path .node .t{display:none}.dojo.v2 .path .node.on .t{display:block;position:absolute;top:38px;white-space:nowrap}.dojo.v2 .path{padding-bottom:22px}
    .dojo.v2 .nav{position:sticky;bottom:0;margin:0 -16px -16px;padding:10px 16px;background:#fffdf7f2;border-radius:0 0 20px 20px;box-shadow:0 -8px 20px #0001}.dojo.v2 .bar{padding:8px 0}.dojo.v2 .kicker{display:none}.dojo.v2 #back{font-size:13px!important;padding:8px 12px!important}.dojo.v2 .cards button{min-width:112px;padding:8px 12px}}`;
