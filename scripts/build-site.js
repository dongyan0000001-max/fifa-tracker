const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const MATCHES_DIR = path.join(ROOT_DIR, "matches");
const BETTOR_ORDER = ["Kaizo", "Thomas", "Zac", "Eric", "TSL", "URIS"];

const TEAM_FLAGS = {
  "Mexico": "🇲🇽",
  "South Africa": "🇿🇦",
  "Czechia": "🇨🇿",
  "Korea Republic": "🇰🇷",
  "Canada": "🇨🇦",
  "Bosnia Herzegovina": "🇧🇦",
  "USA": "🇺🇸",
  "Paraguay": "🇵🇾",
  "Netherlands": "🇳🇱",
  "Japan": "🇯🇵",
  "Sweden": "🇸🇪",
  "Tunisia": "🇹🇳",
  "Germany": "🇩🇪",
  "Curaçao": "🇨🇼",
  "Belgium": "🇧🇪",
  "Egypt": "🇪🇬",
  "Spain": "🇪🇸",
  "Cape Verde": "🇨🇻",
  "Uruguay": "🇺🇾",
  "Saudi Arabia": "🇸🇦",
  "Argentina": "🇦🇷",
  "Algeria": "🇩🇿",
  "Norway": "🇳🇴",
  "Iraq": "🇮🇶",
  "France": "🇫🇷",
  "Senegal": "🇸🇳",
  "Austria": "🇦🇹",
  "Jordan": "🇯🇴"
};

const bets = readJson("bets.json");
const results = readJson("results.json");
const resultsByMatch = new Map(results.map((result) => [result.matchId, result]));
const matches = collectMatches(bets);

build();

function build() {
  fs.mkdirSync(MATCHES_DIR, { recursive: true });

  for (const fileName of fs.readdirSync(MATCHES_DIR)) {
    if (fileName.endsWith(".html")) {
      fs.unlinkSync(path.join(MATCHES_DIR, fileName));
    }
  }

  writePage("index.html", renderIndexPage());
  writePage("calendar.html", renderCalendarPage());
  writePage("completed.html", renderMatchListPage("Completed Matches", "completed", completedMatches()));
  writePage("ongoing.html", renderMatchListPage("On Going Matches", "ongoing", ongoingMatches()));

  for (const match of matches) {
    writePage(path.join("matches", match.fileName), renderMatchPage(match));
  }

  console.log(`Built ${matches.length} match pages from ${bets.length} betting entries.`);
}

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
}

function writePage(fileName, contents) {
  fs.writeFileSync(path.join(ROOT_DIR, fileName), contents);
}

function collectMatches(entries) {
  const byMatch = new Map();

  entries.forEach((bet, index) => {
    validateBet(bet, index);

    if (!byMatch.has(bet.matchId)) {
      byMatch.set(bet.matchId, {
        id: bet.matchId,
        date: bet.date,
        homeTeam: bet.homeTeam,
        awayTeam: bet.awayTeam,
        order: index,
        bets: []
      });
    }

    const match = byMatch.get(bet.matchId);
    for (const field of ["date", "homeTeam", "awayTeam"]) {
      if (match[field] !== bet[field]) {
        throw new Error(`Mismatched ${field} for ${bet.matchId}`);
      }
    }

    match.bets.push({ ...bet, order: index });
  });

  const list = [...byMatch.values()].sort((a, b) => {
    const dateSort = a.date.localeCompare(b.date);
    return dateSort || a.order - b.order;
  });

  for (const match of list) {
    match.plainLabel = `${match.homeTeam} vs ${match.awayTeam}`;
    match.label = matchLabel(match.homeTeam, match.awayTeam);
    match.fileName = `${dateSlug(match.date)}-${slugify(match.homeTeam)}-vs-${slugify(match.awayTeam)}.html`;
  }

  for (const result of results) {
    if (!byMatch.has(result.matchId)) {
      throw new Error(`Result references unknown match ${result.matchId}`);
    }
  }

  return list;
}

function validateBet(bet, index) {
  for (const field of ["matchId", "date", "homeTeam", "awayTeam", "bettor", "pick"]) {
    if (!bet[field]) {
      throw new Error(`Bet ${index + 1} is missing ${field}`);
    }
  }
  if (!Number.isFinite(bet.odds) || bet.odds <= 0) {
    throw new Error(`Bet ${index + 1} has invalid odds`);
  }
  if (!Number.isFinite(bet.stake) || bet.stake <= 0) {
    throw new Error(`Bet ${index + 1} has invalid stake`);
  }
}

function completedMatches() {
  return matches.filter((match) => resultsByMatch.has(match.id));
}

function ongoingMatches() {
  return matches.filter((match) => !resultsByMatch.has(match.id));
}

function matchStats(match) {
  const result = resultsByMatch.get(match.id);
  const settledBets = match.bets.map((bet) => settleBet(bet, result));
  const stake = sum(settledBets, "stake");
  const actualPayout = sum(settledBets, "actualPayout");
  const net = sum(settledBets, "net");

  return {
    ...match,
    result,
    isCompleted: Boolean(result),
    statusLabel: result ? "Completed" : "On Going",
    resultLabel: result ? `Final ${result.finalScore}` : "Pending",
    entries: settledBets.length,
    stake,
    actualPayout,
    net,
    settledBets
  };
}

function settleBet(bet, result) {
  const potentialPayout = roundMoney(bet.stake * bet.odds);

  if (!result) {
    return {
      ...bet,
      status: "Pending",
      displayPayout: potentialPayout,
      actualPayout: 0,
      net: roundMoney(-bet.stake)
    };
  }

  const won = bet.pick === result.finalScore || (bet.pick === "AOS" && result.aos === true);
  const actualPayout = won ? potentialPayout : 0;

  return {
    ...bet,
    status: won ? "Win" : "Lose",
    displayPayout: actualPayout,
    actualPayout,
    net: roundMoney(actualPayout - bet.stake)
  };
}

function renderIndexPage() {
  const stats = matches.map(matchStats);
  const allBets = stats.flatMap((match) => match.settledBets);
  const totalStake = sum(allBets, "stake");
  const totalPayout = sum(allBets, "actualPayout");
  const totalNet = sum(allBets, "net");
  const bettors = bettorSummary(allBets);

  return htmlPage({
    title: "⚽️ FIFA 2026",
    heading: "⚽️ FIFA 2026",
    subtitle: "Read-only betting tracker for bettors. Final score = Completed. Pending = On Going.",
    active: "index",
    body: `
<main>
<section class="card">
  <h2>Overall Summary</h2>
  <div class="grid">
    <div class="kpi"><span class="label">Total Entries</span><b>${allBets.length}</b></div>
    <div class="kpi"><span class="label">Total RM Bet</span><b>${money(totalStake)}</b></div>
    <div class="kpi"><span class="label">Total Payout</span><b>${money(totalPayout)}</b></div>
    <div class="kpi"><span class="label">Current Net</span><b class="${toneClass(totalNet)}">${money(totalNet)}</b></div>
  </div>
  <h2 style="margin-top:18px">By Bettor</h2>
  ${bettors.map(renderPerson).join("")}
</section>
<section class="card">
  <h2>Match Pages</h2>
  <div class="label">Each match opens as a separate HTML page.</div>
  <div class="match-list" style="margin-top:12px">${stats.map((match) => renderMatchCard(match, true)).join("")}</div>
</section>
</main>`
  });
}

function renderPerson(person) {
  return `<div class="person"><div><b>${escapeHtml(person.name)}</b><small>${person.entries} entries · ${money(person.stake)} bet · ${money(person.payout)} payout</small></div><strong class="${toneClass(person.net)}">${money(person.net)}</strong></div>`;
}

function bettorSummary(entries) {
  const names = [...BETTOR_ORDER];
  for (const bet of entries) {
    if (!names.includes(bet.bettor)) {
      names.push(bet.bettor);
    }
  }

  return names.map((name) => {
    const bettorBets = entries.filter((bet) => bet.bettor === name);
    return {
      name,
      entries: bettorBets.length,
      stake: sum(bettorBets, "stake"),
      payout: sum(bettorBets, "actualPayout"),
      net: sum(bettorBets, "net")
    };
  });
}

function renderCalendarPage() {
  const stats = matches.map(matchStats);

  return htmlPage({
    title: "⚽️ FIFA 2026 Calendar",
    heading: "⚽️ FIFA 2026 Calendar",
    subtitle: "Match details: date, who vs who, status, entries and net.",
    active: "calendar",
    body: `<main><section class="card"><h2>Calendar</h2><div class="scroll"><table><thead><tr><th>Date</th><th>Who vs Who</th><th>Result / Status</th><th>Group</th><th class="num">Entries</th><th class="num">RM Bet</th><th class="num">Net</th></tr></thead><tbody>${stats.map(renderCalendarRow).join("")}</tbody></table></div></section></main>`
  });
}

function renderCalendarRow(match) {
  return `<tr><td>${displayDate(match.date)}</td><td><a href="matches/${match.fileName}">${escapeHtml(match.label)}</a></td><td>${escapeHtml(match.resultLabel)}</td><td>${escapeHtml(match.statusLabel)}</td><td class="num">${match.entries}</td><td class="num">${money(match.stake)}</td><td class="num ${toneClass(match.net)}">${money(match.net)}</td></tr>`;
}

function renderMatchListPage(title, active, matchList) {
  const stats = matchList.map(matchStats);

  return htmlPage({
    title: `⚽️ ${title}`,
    heading: `⚽️ ${title}`,
    subtitle: "Separate match pages. Click any match to view the bettor entries.",
    active,
    body: `<main><section class="card"><h2>${escapeHtml(title)}</h2><div class="match-list">${stats.map((match) => renderMatchCard(match, false)).join("")}</div></section></main>`
  });
}

function renderMatchCard(match, showStake) {
  const badgeClass = match.isCompleted ? "done" : "pending";
  const stakeText = showStake ? ` · ${money(match.stake)} bet` : "";

  return `<a class="match-link" href="matches/${match.fileName}">
      <span class="badge ${badgeClass}">${escapeHtml(match.statusLabel)}</span>
      <div class="teams">${escapeHtml(match.label)}</div>
      <div class="meta">${displayDate(match.date)}<br>${escapeHtml(match.resultLabel)} · ${match.entries} entries${stakeText}</div>
      <div class="net ${toneClass(match.net)}">${money(match.net)}</div>
    </a>`;
}

function renderMatchPage(match) {
  const stats = matchStats(match);

  return htmlPage({
    title: `⚽️ ${stats.label}`,
    heading: `⚽️ ${stats.label}`,
    subtitle: `${displayDate(stats.date)} · ${escapeHtml(stats.resultLabel)} · ${escapeHtml(stats.statusLabel)}`,
    basePath: "../",
    body: `
<main>
<section class="card">
  <div class="match-head">
    <div><div class="match-title">${escapeHtml(stats.label)}</div><div class="match-meta">${displayDate(stats.date)} · ${escapeHtml(stats.resultLabel)} · ${escapeHtml(stats.statusLabel)}</div></div>
    <div class="${toneClass(stats.net)}" style="font-size:22px">${money(stats.net)}</div>
  </div>
  <div class="grid" style="margin-bottom:12px">
    <div class="kpi"><span class="label">Entries</span><b>${stats.entries}</b></div>
    <div class="kpi"><span class="label">RM Bet</span><b>${money(stats.stake)}</b></div>
  </div>
  <div class="scroll"><table><thead><tr><th>Bettor</th><th>Pick</th><th class="num">Rate</th><th class="num">RM Bet</th><th>Status</th><th class="num">Payout / Potential</th><th class="num">Net</th></tr></thead>
<tbody>${stats.settledBets.map(renderBetRow).join("")}<tr class="total"><td>Match Total</td><td></td><td></td><td class="num">${money(stats.stake)}</td><td></td><td class="num"></td><td class="num ${toneClass(stats.net)}">${money(stats.net)}</td></tr></tbody></table></div>
</section>
<section class="card"><a class="badge" href="../calendar.html">← Back to Calendar</a></section>
</main>`
  });
}

function renderBetRow(bet) {
  return `<tr><td>${escapeHtml(bet.bettor)}</td><td>${escapeHtml(bet.pick)}</td><td class="num">${odds(bet.odds)}</td>
<td class="num">${money(bet.stake)}</td><td>${escapeHtml(bet.status)}</td><td class="num">${money(bet.displayPayout)}</td><td class="num ${toneClass(bet.net)}">${money(bet.net)}</td></tr>`;
}

function htmlPage({ title, heading, subtitle, active = "", basePath = "", body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title><link rel="stylesheet" href="${basePath}assets/style.css"></head>
<body><section class="hero"><h1>${escapeHtml(heading)}</h1><div class="sub">${subtitle}</div></section>${nav(active, basePath)}${body.startsWith("\n") ? "" : "\n"}${body}</body></html>`;
}

function nav(active, basePath) {
  const items = [
    ["index", "index.html", "Summary"],
    ["calendar", "calendar.html", "Calendar"],
    ["completed", "completed.html", "Completed"],
    ["ongoing", "ongoing.html", "On Going"]
  ];

  return `<nav class="nav">${items.map(([key, href, label]) => `<a class="${active === key ? "" : "secondary"}" href="${basePath}${href}">${label}</a>`).join("")}</nav>`;
}

function teamLabel(team) {
  return `${TEAM_FLAGS[team] || "🏳️"} ${team}`;
}

function matchLabel(homeTeam, awayTeam) {
  return `${teamLabel(homeTeam)} vs ${teamLabel(awayTeam)}`;
}

function displayDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function dateSlug(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sum(entries, field) {
  return roundMoney(entries.reduce((total, entry) => total + entry[field], 0));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return `RM${roundMoney(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function odds(value) {
  return Number(value).toFixed(2);
}

function toneClass(value) {
  if (value > 0) {
    return "good";
  }
  if (value < 0) {
    return "bad";
  }
  return "neutral";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
