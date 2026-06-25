const responsiveStyle = document.createElement("style");
responsiveStyle.textContent = `
  :root{--shell-max:480px}
  html{min-height:100vh;overflow-x:hidden}
  body{min-height:100vh;min-height:100dvh;overflow-x:hidden}
  .app-shell{width:min(100vw,var(--shell-max));min-height:100vh;min-height:100dvh;padding-bottom:24px}
  .app-shell:after{width:min(100vw,var(--shell-max));height:clamp(14px,3.7vw,18px)}
  .brand-scene{min-height:clamp(136px,35vw,164px);padding:clamp(14px,3.8vw,18px) clamp(20px,5.8vw,30px) 28px clamp(22px,6vw,32px)}
  .brand{gap:clamp(16px,5vw,24px);padding-right:clamp(76px,19vw,96px)}
  .brand img{width:clamp(60px,16vw,72px);height:clamp(84px,22.5vw,102px)}
  .brand b{font-size:clamp(32px,9vw,41px)}
  .brand strong{font-size:clamp(26px,7.2vw,33px)}
  .we-are{right:clamp(20px,6vw,30px);top:clamp(28px,8.3vw,40px);font-size:clamp(25px,6.9vw,31px)}
  .nav{margin:-21px clamp(14px,4.5vw,22px) 8px;min-height:40px;padding:0 clamp(10px,3vw,15px)}
  .nav a{min-height:40px;font-size:clamp(13px,3.45vw,15px)}
  main{padding:0 clamp(14px,4.5vw,22px) 76px}
  .kpi-grid{gap:6px}
  .kpi-card{gap:12px;min-height:58px;padding:10px clamp(11px,3.2vw,14px)}
  .kpi-card b{font-size:clamp(20px,5.8vw,24px)}
  .kpi-card:nth-child(3) b,.kpi-card:nth-child(4) b{font-size:clamp(18px,5.2vw,22px)}
  .kpi-card span:last-child{font-size:14px}
  .kpi-icon{width:34px;height:34px;font-size:17px}
  .kpi-clipboard:before{left:10px;top:9px;width:12px;height:15px}
  .kpi-clipboard:after{left:15px;top:8px;width:5px}
  .kpi-wallet:before,.kpi-payout:before{left:9px;top:12px;width:17px;height:12px}
  .kpi-wallet:after{left:13px;top:10px;width:11px;height:6px}
  .kpi-payout:after{right:9px;top:15px}
  .kpi-trend:before{font-size:22px}
`;
document.head.appendChild(responsiveStyle);

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function reorderStandings() {
  const list = document.querySelector(".standings-panel .standing-list");
  if (!list) return;

  const rows = Array.from(list.querySelectorAll(".standing-row"));
  rows
    .sort((a, b) => parseMoney(b.querySelector("strong")?.textContent) - parseMoney(a.querySelector("strong")?.textContent))
    .forEach((row, index) => {
      const rank = row.querySelector(".rank");
      if (rank) {
        rank.textContent = ["🏆", "🥈", "🥉"][index] || String(index + 1);
        rank.className = index < 3 ? "rank rank-medal" : "rank";
      }
      list.appendChild(row);
    });
}

function applyLivePolish() {
  setMeta("theme-color", "#ffffff");
  setMeta("apple-mobile-web-app-status-bar-style", "default");
  reorderStandings();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyLivePolish, { once: true });
} else {
  applyLivePolish();
}

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-filter-input]");
  if (!input) return;

  const target = input.getAttribute("data-filter-target");
  const scope = document.querySelector(`[data-filter-table="${target}"]`);
  if (!scope) return;

  const query = input.value.trim().toLowerCase();
  const items = scope.matches("table")
    ? scope.querySelectorAll("tbody tr")
    : scope.querySelectorAll("[data-search]");

  items.forEach((item) => {
    const text = (item.getAttribute("data-search") || item.textContent || "").toLowerCase();
    item.hidden = query.length > 0 && !text.includes(query);
  });
});
