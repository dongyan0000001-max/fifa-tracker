const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ASSET_PATH = "assets/knockout-stage.svg";
const STYLE_VERSION = "20260629-knockout";
const NAV_HTML = '<nav class="nav"><a class="{index}" href="{base}index.html">Summary</a><a class="{ongoing}" href="{base}ongoing.html">Knockout Stage</a><a class="{group}" href="{base}group-stage.html">Group Stage (Completed)</a></nav>';

postprocess();

function postprocess() {
  ensureGroupStagePage();
  removePage("calendar.html");
  removePage("completed.html");
  updateStyles();

  for (const filePath of htmlFiles(ROOT_DIR)) {
    let html = read(filePath);
    const relativePath = path.relative(ROOT_DIR, filePath);
    const base = relativePath.includes(path.sep) ? "../" : "";
    const active = pageKey(relativePath);

    html = rewriteNav(html, base, active);
    html = html.replace(/assets\/style\.css\?v=[^"]+/g, `assets/style.css?v=${STYLE_VERSION}`);
    html = html.replaceAll(`${base}calendar.html`, `${base}index.html`);
    html = html.replaceAll(`${base}completed.html`, `${base}group-stage.html`);
    html = html.replaceAll("Back to Calendar", "Back to Summary");
    html = html.replaceAll("Back to Completed", "Back to Group Stage (Completed)");

    if (relativePath === "index.html") html = rewriteSummary(html);
    if (relativePath === "ongoing.html") html = rewriteKnockoutStage(html);
    if (relativePath === "group-stage.html") html = rewriteGroupStage(html);

    write(filePath, html);
  }
}

function ensureGroupStagePage() {
  const groupStagePath = pagePath("group-stage.html");
  const completedPath = pagePath("completed.html");
  if (!fs.existsSync(groupStagePath) && fs.existsSync(completedPath)) {
    write(groupStagePath, read(completedPath));
  }
}

function rewriteNav(html, base, active) {
  return html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, nav(base, active));
}

function nav(base, active) {
  return NAV_HTML
    .replace("{base}", base)
    .replace("{base}", base)
    .replace("{base}", base)
    .replace("{index}", active === "index" ? "is-active" : "")
    .replace("{ongoing}", active === "ongoing" ? "is-active" : "")
    .replace("{group}", active === "group-stage" ? "is-active" : "");
}

function rewriteSummary(html) {
  const knockout = `
  <section class="panel knockout-panel">
    <img src="${ASSET_PATH}" alt="2026 FIFA World Cup knockout stage bracket">
  </section>
`;
  let output = html
    .replace(/\n\s*<section class="panel podium-panel">[\s\S]*?<\/section>\n/g, "\n")
    .replace(/\n\s*<section class="panel fixture-panel">[\s\S]*?<section class="panel selected-panel">[\s\S]*?<\/section>\n/, `\n${knockout}`)
    .replace(/\n\s*<section class="panel knockout-panel">[\s\S]*?<\/section>\n/g, `\n${knockout}`);

  output = rewriteStandings(output);

  if (!output.includes("knockout-stage.svg")) {
    output = output.replace("</main>", `${knockout}</main>`);
  }
  return output;
}

function rewriteStandings(html) {
  const standingsPattern = /(<section class="panel standings-panel">\s*<div class="standing-list" id="bettors">)([\s\S]*?)(\s*<\/div>\s*<\/section>)/;
  const match = html.match(standingsPattern);
  if (!match) return html;

  const rows = [...match[2].matchAll(/<a class="standing-row"[\s\S]*?<\/a>/g)].map((rowMatch) => {
    const row = rowMatch[0];
    const name = textMatch(row, /standing-name"><b>([^<]+)<\/b>/);
    const netText = textMatch(row, /<strong class="[^"]+">(RM[^<]+)<\/strong>/);
    const net = Number(netText.replace("RM", "").replace(/,/g, ""));
    const href = textMatch(row, /href="([^"]+)"/);
    return { row, name, netText, net, href };
  }).filter((row) => row.name && Number.isFinite(row.net));

  if (!rows.length) return html;

  rows.sort((a, b) => b.net - a.net);
  const standingRows = rows.map((row, index) => {
    const rank = rankLabel(index);
    const rankClass = index < 3 ? "rank rank-medal" : "rank";
    return row.row.replace(/<span class="rank[^"]*">[\s\S]*?<\/span>/, `<span class="${rankClass}">${rank}</span>`);
  }).join("");
  const podium = renderPodium(rows.slice(0, 3));
  const standings = `${match[1]}\n      ${standingRows}${match[3]}`;

  return html.replace(standingsPattern, `${podium}\n\n  ${standings}`);
}

function renderPodium(leaders) {
  const stageOrder = [leaders[1], leaders[0], leaders[2]].filter(Boolean);
  return `  <section class="panel podium-panel">
    <div class="section-head podium-head">
      <div><span class="section-icon">🏆</span><h2>Group Stage Podium</h2></div>
    </div>
    <div class="podium-stage">
      ${stageOrder.map((bettor) => renderPodiumPlace(bettor, leaders.indexOf(bettor) + 1)).join("")}
    </div>
  </section>`;
}

function renderPodiumPlace(bettor, place) {
  return `<a class="podium-card podium-${place}" href="${bettor.href}">
    <div class="podium-portrait"><span>${escapeHtml(bettor.name.slice(0, 1))}</span></div>
    <b>${bettor.name}</b>
    <strong class="${toneClass(bettor.net)}">${bettor.netText}</strong>
    <div class="podium-block"><span>${place}</span></div>
  </a>`;
}

function rewriteKnockoutStage(html) {
  return html
    .replaceAll("On Going Matches", "Knockout Stage")
    .replaceAll("FIFA 2026 On Going Matches", "FIFA 2026 Knockout Stage");
}

function rewriteGroupStage(html) {
  return html
    .replace(/<title>FIFA 2026 (?:Completed|Group Stage)(?: \(Completed\))?<\/title>/, "<title>FIFA 2026 Group Stage (Completed)</title>")
    .replace(/<h2>(?:Completed Matches|Group Stage)(?: \(Completed\))?<\/h2>/, "<h2>Group Stage (Completed)</h2>")
    .replaceAll("Completed Matches", "Group Stage (Completed)")
    .replaceAll("FIFA 2026 Completed", "FIFA 2026 Group Stage (Completed)")
    .replaceAll("completed-cards", "group-stage-cards");
}

function updateStyles() {
  const stylePath = path.join(ROOT_DIR, "assets", "style.css");
  if (!fs.existsSync(stylePath)) return;

  let css = read(stylePath);
  css = css.replace("grid-template-columns:repeat(4,1fr);", "grid-template-columns:repeat(3,minmax(0,1fr));");

  if (!css.includes(".knockout-panel")) {
    css += `
.knockout-panel{
  margin-top:8px;
  padding:10px;
  background:#fff;
}
.knockout-panel img{
  display:block;
  width:100%;
  height:auto;
  border-radius:10px;
}
`;
  }
  if (!css.includes(".podium-panel")) {
    css += `
.podium-panel{
  margin-top:8px;
  color:#fff;
  background:
    linear-gradient(135deg,rgba(211,7,28,.28),transparent 34%),
    linear-gradient(315deg,rgba(151,255,0,.28),transparent 34%),
    #080808;
  border-color:rgba(255,255,255,.16);
}
.podium-head{border-bottom:1px solid rgba(255,255,255,.14)}
.podium-head h2{color:#fff}
.podium-stage{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1.08fr) minmax(0,1fr);
  align-items:end;
  gap:8px;
  padding:14px 12px 12px;
}
.podium-card{
  min-width:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  color:#fff;
  text-decoration:none;
}
.podium-portrait{
  width:58px;
  height:58px;
  display:grid;
  place-items:center;
  overflow:hidden;
  border:3px solid #fff;
  border-radius:50%;
  background:#111;
  box-shadow:0 9px 18px rgba(0,0,0,.28);
}
.podium-portrait img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.podium-portrait span{
  color:#fff;
  font-size:24px;
  font-weight:1000;
}
.podium-1 .podium-portrait{
  width:72px;
  height:72px;
  border-color:var(--yellow);
}
.podium-card b{
  max-width:100%;
  margin-top:7px;
  overflow:hidden;
  color:#fff;
  font-size:14px;
  line-height:1.05;
  font-weight:1000;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.podium-card strong{
  margin-top:4px;
  padding:4px 7px;
  border-radius:999px;
  background:rgba(255,255,255,.1);
  font-size:12px;
  line-height:1;
  font-weight:1000;
  white-space:nowrap;
}
.podium-block{
  width:100%;
  margin-top:9px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.18);
  border-radius:10px 10px 6px 6px;
  background:linear-gradient(180deg,#fff,#d9dce2);
  color:#050505;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9);
}
.podium-block span{
  font-size:25px;
  line-height:1;
  font-weight:1000;
}
.podium-1 .podium-block{
  height:76px;
  background:linear-gradient(180deg,#fff36a,#d7a014);
}
.podium-2 .podium-block{height:58px}
.podium-3 .podium-block{
  height:46px;
  background:linear-gradient(180deg,#ffd8a7,#bd6c28);
}
`;
  }

  write(stylePath, css);
}

function htmlFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && ["matches", "bettors"].includes(entry.name)) return htmlFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith(".html")) return [fullPath];
    return [];
  });
}

function pageKey(relativePath) {
  if (relativePath === "index.html") return "index";
  if (relativePath === "ongoing.html") return "ongoing";
  if (relativePath === "group-stage.html") return "group-stage";
  return "";
}

function pagePath(fileName) {
  return path.join(ROOT_DIR, fileName);
}

function removePage(fileName) {
  const filePath = pagePath(fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, contents) {
  fs.writeFileSync(filePath, contents);
}

function rankLabel(index) {
  return ["🏆", "🥈", "🥉"][index] || String(index + 1);
}

function toneClass(value) {
  if (value > 0) return "good";
  if (value < 0) return "bad";
  return "neutral";
}

function textMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1] : "";
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
