const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ASSET_PATH = "assets/knockout-stage.svg";
const STYLE_VERSION = "20260629-group-stage";
const NAV_HTML = '<nav class="nav"><a class="{index}" href="{base}index.html">Summary</a><a class="{ongoing}" href="{base}ongoing.html">On Going</a><a class="{group}" href="{base}group-stage.html">Group Stage</a></nav>';

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
    html = html.replaceAll("Back to Completed", "Back to Group Stage");

    if (relativePath === "index.html") html = rewriteSummary(html);
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
    .replace(/\n\s*<section class="panel fixture-panel">[\s\S]*?<section class="panel selected-panel">[\s\S]*?<\/section>\n/, `\n${knockout}`)
    .replace(/\n\s*<section class="panel knockout-panel">[\s\S]*?<\/section>\n/g, `\n${knockout}`);

  if (!output.includes("knockout-stage.svg")) {
    output = output.replace("</main>", `${knockout}</main>`);
  }
  return output;
}

function rewriteGroupStage(html) {
  return html
    .replaceAll("Completed Matches", "Group Stage")
    .replaceAll("FIFA 2026 Completed", "FIFA 2026 Group Stage")
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
