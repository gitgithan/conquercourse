const COMMUNITY_DETAILS = new Map(JSON.parse(document.getElementById('community-data').textContent).map(c => [String(c.id), c]));
const nativeShowInfo = showInfo;
let selectedCommunity = null;
function renderCommunityMembers(query = '') {
  const c = COMMUNITY_DETAILS.get(selectedCommunity);
  if (!c) return;
  const q = query.toLowerCase();
  const files = c.files.filter(f => f.path.toLowerCase().includes(q));
  const symbols = c.symbols.filter(s => `${s.name} ${s.file}`.toLowerCase().includes(q));
  document.getElementById('community-files').innerHTML = files.map(f => `<div class="community-row"><a href="../${esc(f.path.split('/').map(encodeURIComponent).join('/'))}">${esc(f.path)}</a> <span class="community-muted">(${f.count})</span></div>`).join('') || '<p>No matching files.</p>';
  document.getElementById('community-symbols').innerHTML = symbols.map(s => `<div class="community-row"><strong>${esc(s.name)}</strong><br><span class="community-muted">${esc(s.file || 'External / unsourced reference')} ${esc(s.line)}</span></div>`).join('') || '<p>No matching symbols.</p>';
  document.getElementById('community-member-count').textContent = `${files.length} files · ${symbols.length} member nodes`;
}
showInfo = function(nodeId) {
  const c = COMMUNITY_DETAILS.get(String(nodeId));
  if (!c) { nativeShowInfo(nodeId); return; }
  selectedCommunity = String(nodeId);
  document.querySelector('#info-panel > h3').textContent = 'Community details';
  document.getElementById('info-content').innerHTML = `<h2 class="community-title">${esc(c.name)}</h2><p class="community-muted">Community ${esc(c.id)} · ${c.size} nodes · ${c.files.length} files</p><p class="community-purpose">${esc(c.purpose)}</p><p class="community-muted community-note">Model interpretation from indexed paths and symbols; verify behavior in source.</p><details open><summary>Connected communities (${c.neighbors.length})</summary><div class="community-neighbors">${c.neighbors.map(n => `<button type="button" data-community-id="${esc(n.id)}">${esc(n.name)} <span class="community-muted">(${n.count})</span></button>`).join('') || 'No cross-community links.'}</div></details><label for="community-filter">Find member files or symbols</label><input id="community-filter" type="search" placeholder="Filter this community…"><p id="community-member-count" class="community-muted"></p><details open><summary>Member files</summary><div id="community-files"></div></details><details open><summary>Member symbols and source locations</summary><div id="community-symbols"></div></details>`;
  renderCommunityMembers();
};
document.addEventListener('input', e => {
  if (e.target.id === 'community-filter') renderCommunityMembers(e.target.value);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-community-id]');
  if (b) {
    focusNode(b.dataset.communityId);
    history.replaceState(null, '', '#community-' + b.dataset.communityId);
    document.getElementById('info-panel').scrollTop = 0;
  }
});
if (location.hash.startsWith('#community-')) {
  const cid = location.hash.slice('#community-'.length);
  if (COMMUNITY_DETAILS.has(cid)) focusNode(cid);
}

// Keep only the selected community's one-hop neighborhood visually prominent.
let focusedCommunity = null;
const originalNodeStyles = new Map(nodesDS.get().map(n => [String(n.id), {color: structuredClone(n.color), font: structuredClone(n.font), borderWidth: n.borderWidth ?? 1.5}]));
const originalEdgeStyles = new Map(edgesDS.get().map(e => [e.id, {color: structuredClone(e.color), width: e.width}]));
const edgeScreenPx = new Map();
let edgeZoomQueued = false;
function keepEdgeWidthOnScreen() {
  if (edgeZoomQueued) return;
  edgeZoomQueued = true;
  requestAnimationFrame(() => {
    edgeZoomQueued = false;
    const s = network.getScale();
    edgesDS.update(edgesDS.get().map(e => ({id:e.id, width:(edgeScreenPx.get(e.id) || 1) / s})));
  });
}
['zoom','animationFinished','stabilized','resize'].forEach(ev => network.on(ev, keepEdgeWidthOnScreen));
setTimeout(keepEdgeWidthOnScreen, 1500);
function highlightCommunity(nodeId) {
  focusedCommunity = nodeId == null ? null : String(nodeId);
  const neighbors = focusedCommunity == null ? new Set() : new Set(network.getConnectedNodes(focusedCommunity).map(String));
  nodesDS.update(nodesDS.get().map(n => {
    const original = originalNodeStyles.get(String(n.id));
    const prominent = focusedCommunity == null || String(n.id) === focusedCommunity || neighbors.has(String(n.id));
    return {id:n.id, opacity:prominent ? 1 : 0.12, color:structuredClone(original.color), borderWidth:String(n.id) === focusedCommunity ? 4 : original.borderWidth, font:{...original.font,color:prominent ? themeLabelColor : (document.documentElement.dataset.theme === 'light' ? '#c5c9cf' : '#383845')}};
  }));
  edgesDS.update(edgesDS.get().map(e => {
    const original = originalEdgeStyles.get(e.id);
    const prominent = focusedCommunity == null || String(e.from) === focusedCommunity || String(e.to) === focusedCommunity;
    const color = typeof original.color === 'string' ? {color:original.color} : {...original.color};
    // Bright lines (owner, 2026-11-04: "way too dim in dark mode"): the colour comes from the theme, so Light and Dark both read.
    const rootStyle = getComputedStyle(document.documentElement);
    color.color = rootStyle.getPropertyValue('--edge').trim() || color.color;
    color.highlight = color.hover = rootStyle.getPropertyValue('--edge-hot').trim() || color.color;
    color.opacity = prominent ? (focusedCommunity == null ? 0.38 : 0.9) : 0.05;
    // Width is in screen pixels (owner, 2026-11-04): zooming in must not fatten the lines, so they thin out and labels stay readable.
    edgeScreenPx.set(e.id, focusedCommunity != null && prominent ? 2 : (focusedCommunity == null ? 1 : 0.5));
    return {id:e.id,color,width:edgeScreenPx.get(e.id) / network.getScale()};
  }));
  if (focusedCommunity != null) network.selectNodes([focusedCommunity], false);
}
const nativeFocusCommunity = focusNode;
focusNode = function(nodeId) { nativeFocusCommunity(nodeId); highlightCommunity(nodeId); };
network.on('click', params => highlightCommunity(params.nodes.length ? params.nodes[0] : null));
document.addEventListener('click', e => {
  if (e.target.closest('[data-theme-choice]')) highlightCommunity(focusedCommunity);
});
highlightCommunity(location.hash.startsWith('#community-') ? location.hash.slice('#community-'.length) : null);
