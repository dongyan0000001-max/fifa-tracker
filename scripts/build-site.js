const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const MATCHES_DIR = path.join(ROOT_DIR, "matches");
const BETTORS_DIR = path.join(ROOT_DIR, "bettors");
const KNOCKOUT_START_DATE = "2026-06-28";
const BETTOR_ORDER = ["Kaizo", "Thomas", "Zac", "Eric", "URIS"];
const FIFA_2026_LOGO_URL = "https://pub-3bd35431294c47068cbf31a95d572166.r2.dev/logos/fifa-world-cup-2026/fifa-world-cup-2026-logo-footylogos.png";
const STYLE_VERSION = "20260625-mobile-fit";
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
  "Jordan": "🇯🇴",
  "Colombia": "🇨🇴",
  "Uzbekistan": "🇺🇿",
  "Panama": "🇵🇦",
  "Ghana": "🇬🇭",
  "Turkey": "🇹🇷",
  "Australia": "🇦🇺",
  "Brazil": "🇧🇷",
  "Morocco": "🇲🇦",
  "Scotland": "🏴",
  "Haiti": "🇭🇹",
  "New Zealand": "🇳🇿",
  "Iran": "🇮🇷",
  "Ecuador": "🇪🇨",
  "Ivory Coast": "🇨🇮",
  "Switzerland": "🇨🇭",
  "Qatar": "🇶🇦",
  "DR Congo": "🇨🇩",
  "Portugal": "🇵🇹",
  "Croatia": "🇭🇷",
  "England": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}"
};

const bets = readJson("bets.json");
const results = readJson("results.json");
const resultsByMatch = new Map(results.map((result) => [result.matchId, result]));
const matches = collectMatches(bets);

build();

function build() {
  fs.mkdirSync(MATCHES_DIR, { recursive: true });
  fs.mkdirSync(BETTORS_DIR, { recursive: true });

  for (const fileName of fs.readdirSync(MATCHES_DIR)) {
    if (fileName.endsWith(".html")) fs.unlinkSync(path.join(MATCHES_DIR, fileName));
  }
  for (const fileName of fs.readdirSync(BETTORS_DIR)) {
    if (fileName.endsWith(".html")) fs.unlinkSync(path.join(BETTORS_DIR, fileName));
  }

  writePage("index.html", renderIndexPage());
  writePage("calendar.html", renderCalendarPage());
  writePage("completed.html", renderMatchListPage("Completed Matches", "completed", groupStageCompletedMatches()));
  writePage("ongoing.html", renderMatchListPage("On Going Matches", "ongoing", knockoutStageMatches()));

  for (const match of matches) writePage(path.join("matches", match.fileName), renderMatchPage(match));
  for (const bettor of bettorSummary(allSettledBets())) writePage(path.join("bettors", bettor.fileName), renderBettorPage(bettor));

  console.log(`Built ${matches.length} match pages and ${BETTOR_ORDER.length} bettor pages from ${bets.length} betting entries.`);
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
      byMatch.set(bet.matchId, { id: bet.matchId, date: bet.date, homeTeam: bet.homeTeam, awayTeam: bet.awayTeam, order: index, bets: [] });
    }
    const match = byMatch.get(bet.matchId);
    for (const field of ["date", "homeTeam", "awayTeam"]) {
      if (match[field] !== bet[field]) throw new Error(`Mismatched ${field} for ${bet.matchId}`);
    }
    match.bets.push({ ...bet, order: index });
  });

  const list = [...byMatch.values()].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  for (const match of list) {
    match.plainLabel = `${match.homeTeam} vs ${match.awayTeam}`;
    match.label = matchLabel(match.homeTeam, match.awayTeam);
    match.fileName = `${dateSlug(match.date)}-${slugify(match.homeTeam)}-vs-${slugify(match.awayTeam)}.html`;
  }

  for (const result of results) {
    if (!byMatch.has(result.matchId)) throw new Error(`Result references unknown match ${result.matchId}`);
  }
  return list;
}

function validateBet(bet, index) {
  for (const field of ["matchId", "date", "homeTeam", "awayTeam", "bettor", "pick"]) {
    if (!bet[field]) throw new Error(`Bet ${index + 1} is missing ${field}`);
  }
  if (!Number.isFinite(bet.odds) || bet.odds <= 0) throw new Error(`Bet ${index + 1} has invalid odds`);
  if (!Number.isFinite(bet.stake) || bet.stake <= 0) throw new Error(`Bet ${index + 1} has invalid stake`);
}

function completedMatches() { return matches.filter((match) => resultsByMatch.has(match.id)); }
function ongoingMatches() { return matches.filter((match) => !resultsByMatch.has(match.id)); }
function isKnockoutMatch(match) { return match.date >= KNOCKOUT_START_DATE; }
function groupStageCompletedMatches() { return completedMatches().filter((match) => !isKnockoutMatch(match)); }
function knockoutStageMatches() { return matches.filter(isKnockoutMatch); }

function matchStats(match) {
  const result = resultsByMatch.get(match.id);
  const settledBets = match.bets.map((bet) => settleBet(bet, result, match));
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

function settleBet(bet, result, match) {
  const potentialPayout = roundMoney(bet.stake * bet.odds);
  if (!result) return { ...bet, status: "Pending", displayPayout: potentialPayout, actualPayout: 0, net: roundMoney(-bet.stake) };

  const manual = manualSettlementForBet(bet);
  if (manual) return { ...bet, ...manual };

  const settlement = settleSpecialBet(bet, result, match);
  if (settlement) return { ...bet, ...settlement };

  const won = bet.pick === result.finalScore || (bet.pick === "AOS" && result.aos === true) || isSpecialWinningBet(bet, result);
  const actualPayout = won ? potentialPayout : 0;
  return { ...bet, status: won ? "Win" : "Lose", displayPayout: actualPayout, actualPayout, net: roundMoney(won ? actualPayout - bet.stake : -bet.stake) };
}

function manualSettlementForBet(bet) {
  const manual = bet.manualSettlement;
  if (!manual) return null;

  return {
    status: manual.status || "Settled",
    displayPayout: Number(manual.displayPayout) || 0,
    actualPayout: Number(manual.actualPayout) || 0,
    net: roundMoney(Number(manual.net) || 0)
  };
}

function settleSpecialBet(bet, result, match) {
  const score = parseScore(result.finalScore);
  if (!score) return null;
  const pick = String(bet.pick).trim();
  const pickLower = pick.toLowerCase();
  const total = score.home + score.away;

  if (pickLower === "over 2.5" || pickLower === "over (2.5)") {
    return total > 2.5 ? winSettlement(bet) : loseSettlement(bet);
  }
  if (pickLower === "under 2.5" || pickLower === "under (2.5)") {
    return total < 2.5 ? winSettlement(bet) : loseSettlement(bet);
  }
  if (pickLower === "under 3/3.5" || pickLower === "under 3.25") {
    return total <= 3 ? winSettlement(bet) : loseSettlement(bet);
  }

  if (bet.matchId === "2026-06-23-england-vs-ghana" && bet.bettor === "Thomas" && pick === "England FH -1") {
    return { status: "Lose", displayPayout: 0, actualPayout: 0, net: -81 };
  }
  if (bet.matchId === "2026-06-23-england-vs-ghana" && bet.bettor === "Kaizo" && pick === "England -0.5/1 First Half") {
    return loseSettlement(bet);
  }

  const handicap = parseHandicapPick(pick);
  if (!handicap) return null;

  const team = normalizeTeamName(handicap.team);
  const isHome = team === normalizeTeamName(match.homeTeam);
  const isAway = team === normalizeTeamName(match.awayTeam);
  if (!isHome && !isAway) return null;

  const teamGoals = isHome ? score.home : score.away;
  const otherGoals = isHome ? score.away : score.home;
  const margin = teamGoals - otherGoals;
  const line = handicap.line;

  if (line === -1) {
    if (margin > 1) return winSettlement(bet);
    if (margin === 1) return pushSettlement(bet);
    return loseSettlement(bet);
  }
  if (line === -0.25 || line === -0.5 || line === -0.75) {
    return margin > 0 ? winSettlement(bet) : loseSettlement(bet);
  }
  if (Number.isInteger(line) || Math.abs(line % 1) === 0.5) {
    const adjustedMargin = margin + line;
    if (adjustedMargin > 0) return winSettlement(bet);
    if (adjustedMargin === 0) return pushSettlement(bet);
    return loseSettlement(bet);
  }

  return null;
}

function winSettlement(bet) {
  const actualPayout = roundMoney(bet.stake * bet.odds);
  return { status: "Win", displayPayout: actualPayout, actualPayout, net: roundMoney(actualPayout - bet.stake) };
}

function loseSettlement(bet) {
  return { status: "Lose", displayPayout: 0, actualPayout: 0, net: roundMoney(-bet.stake) };
}

function pushSettlement(bet) {
  return { status: "Push", displayPayout: bet.stake, actualPayout: bet.stake, net: 0 };
}

function parseScore(scoreText) {
  const match = String(scoreText || "").match(/^(\d+)\s*-\s*(\d+)$/);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

function parseHandicapPick(pick) {
  const match = String(pick).match(/^(.+?)\s+(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s|$)/i);
  if (!match) return null;
  const first = Number(match[2]);
  const second = match[3] ? Number(match[3]) * (first < 0 ? -1 : 1) : first;
  return { team: match[1], line: (first + second) / 2 };
}

function normalizeTeamName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSpecialWinningBet(bet, result) {
  const score = String((result && result.finalScore) || "").match(/^(\d+)-(\d+)$/);
  if (!score) return false;
  const home = Number(score[1]);
  const away = Number(score[2]);
  const total = home + away;
  if (bet.matchId === "2026-06-22-norway-vs-senegal" && bet.bettor === "URIS" && bet.pick === "Norway -0/0.5") return home > away;
  if (bet.matchId === "2026-06-22-norway-vs-senegal" && bet.bettor === "Kaizo" && bet.pick === "Over 2.5") return total > 2.5;
  return false;
}

function allSettledBets() {
  return matches.flatMap((match) => {
    const stats = matchStats(match);
    return stats.settledBets.map((bet) => ({
      ...bet,
      matchLabel: stats.label,
      matchPlainLabel: stats.plainLabel,
      matchFileName: stats.fileName,
      resultLabel: stats.resultLabel,
      statusLabel: stats.statusLabel
    }));
  });
}

function renderIndexPage() {
  const allBets = allSettledBets();
  const totalStake = sum(allBets, "stake");
  const totalPayout = sum(allBets, "actualPayout");
  const totalNet = sum(allBets, "net");
  const bettors = bettorSummary(allBets);
  const ongoing = ongoingMatches().map(matchStats);
  const latestCompleted = completedMatches().map(matchStats).slice(-6).reverse();
  const selectedMatch = ongoing[0] || latestCompleted[0];

  return htmlPage({
    title: "FIFA 2026 Bets Tracker",
    active: "index",
    summary: { entries: allBets.length, totalStake, totalPayout, totalNet },
    body: `
<main class="dashboard">
  ${renderKpiGrid([
    ["Entries", allBets.length, "clipboard"],
    ["Bet", moneyShort(totalStake), "wallet"],
    ["Payout", money(totalPayout), "payout"],
    ["Net", money(totalNet), "trend", toneClass(totalNet)]
  ])}

  <section class="panel standings-panel">
    <div class="standing-list" id="bettors">
      ${bettors.map((bettor, index) => renderBettorStanding(bettor, index, "")).join("")}
    </div>
  </section>

  <section class="panel fixture-panel">
    <div class="section-head">
      <div><span class="section-icon ball-icon">⚽</span><h2>On Going Matches</h2></div>
      <a class="quiet-link" href="ongoing.html">View all<span class="chevron"></span></a>
    </div>
    <div class="fixture-list">
      ${(ongoing.length ? ongoing : latestCompleted.slice(0, 3)).slice(0, 3).map((match, index) => renderFixtureCard(match, index === 0)).join("")}
    </div>
  </section>

  ${selectedMatch ? renderSelectedMatch(selectedMatch, "") : ""}
</main>`
  });
}

function renderKpiGrid(items) {
  return `<section class="kpi-grid">${items.map(([label, value, icon, tone]) => `
    <div class="kpi-card ${tone ? `tone-${tone}` : ""}">
      <span class="kpi-icon kpi-${icon}"></span>
      <div><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>
    </div>`).join("")}</section>`;
}

function renderBettorStanding(bettor, index, basePath) {
  const href = `${basePath}bettors/${bettor.fileName}`;
  const rank = rankLabel(index);
  const rankClass = index < 3 ? "rank rank-medal" : "rank";
  return `<a class="standing-row" href="${href}" data-search="${searchText([bettor.name, bettor.entries, bettor.stake, bettor.payout, bettor.net])}">
    <span class="${rankClass}">${rank}</span>
    <span class="avatar">${escapeHtml(bettor.name.slice(0, 1))}</span>
    <span class="standing-name"><b>${escapeHtml(bettor.name)}</b></span>
    <strong class="${toneClass(bettor.net)}">${money(bettor.net)}</strong>
    <span class="chevron"></span>
  </a>`;
}

function bettorSummary(entries) {
  const names = [...BETTOR_ORDER];
  for (const bet of entries) if (!names.includes(bet.bettor)) names.push(bet.bettor);
  return names.map((name) => {
    const bettorBets = entries.filter((bet) => bet.bettor === name);
    return {
      name,
      entries: bettorBets.length,
      stake: sum(bettorBets, "stake"),
      payout: sum(bettorBets, "actualPayout"),
      net: sum(bettorBets, "net"),
      fileName: `${slugify(name)}.html`,
      bets: bettorBets
    };
  }).sort((a, b) => a.net - b.net || names.indexOf(a.name) - names.indexOf(b.name));
}

function renderFixtureCard(match, selected = false, basePath = "") {
  const href = `${basePath}matches/${match.fileName}`;
  return `<a class="fixture-card ${selected ? "is-selected" : ""}" href="${href}" data-search="${searchText([match.plainLabel, match.resultLabel, match.statusLabel, match.stake, match.net])}">
    <div class="fixture-date">${displayDateShort(match.date)}</div>
    <div class="fixture-main">
      <div class="fixture-teams">${flagBadge(match.homeTeam)}<b>${escapeHtml(match.homeTeam)}</b><em>vs</em><b>${escapeHtml(match.awayTeam)}</b>${flagBadge(match.awayTeam)}</div>
      <div class="fixture-meta"><span>${match.entries} entries</span><i></i><span>${money(match.stake)}</span><i></i><strong class="${toneClass(match.net)}">${money(match.net)}</strong></div>
    </div>
    ${statusChip(match.resultLabel)}
    <span class="chevron"></span>
  </a>`;
}

function renderMatchTable(matchList, filterId, linkMode, basePath = "") {
  return `<div class="table-wrap"><table class="data-table" data-filter-table="${filterId}">
    <thead><tr><th>Date</th><th>Match</th><th>Result / Status</th><th class="num">Entries</th><th class="num">RM Bet</th><th class="num">Net</th></tr></thead>
    <tbody>${matchList.map((match) => renderCalendarRow(match, linkMode, basePath)).join("")}</tbody>
  </table></div>`;
}

function renderCalendarPage() {
  const stats = matches.map(matchStats);
  return htmlPage({
    title: "FIFA 2026 Calendar",
    active: "calendar",
    body: `
<main>
  <section class="panel page-panel">
    <div class="section-head section-head-tools">
      <div><span class="section-icon">📅</span><h2>Calendar</h2><p>All matches, results, entries and net totals.</p></div>
      <label class="search-box"><span>Search</span><input type="search" placeholder="Search match..." data-filter-input data-filter-target="calendar"></label>
    </div>
    ${renderMatchTable(stats, "calendar", "calendar")}
  </section>
</main>`
  });
}

function renderCalendarRow(match, linkMode = "calendar", basePath = "") {
  const href = `${basePath}matches/${match.fileName}`;
  const search = searchText([match.date, match.plainLabel, match.resultLabel, match.statusLabel, match.entries, match.stake, match.net]);
  return `<tr data-search="${search}">
    <td>${displayDate(match.date)}</td>
    <td><a class="match-cell" href="${href}">${escapeHtml(match.label)}</a></td>
    <td>${statusChip(match.resultLabel)} <span class="muted-inline">${escapeHtml(match.statusLabel)}</span></td>
    <td class="num">${match.entries}</td>
    <td class="num">${money(match.stake)}</td>
    <td class="num ${toneClass(match.net)}">${money(match.net)}</td>
  </tr>`;
}

function renderMatchListPage(title, active, matchList) {
  const stats = matchList.map(matchStats);
  return htmlPage({
    title: `FIFA 2026 ${title}`,
    active,
    body: `
<main>
  <section class="panel page-panel">
    <div class="section-head section-head-tools">
      <div><span class="section-icon">${active === "completed" ? "✅" : "⚽"}</span><h2>${escapeHtml(title)}</h2><p>Tap any fixture to see every bettor entry.</p></div>
      <label class="search-box"><span>Search</span><input type="search" placeholder="Search match..." data-filter-input data-filter-target="${active}-cards"></label>
    </div>
    <div class="match-card-grid" data-filter-table="${active}-cards">${stats.map((match) => renderMatchCard(match, "")).join("")}</div>
  </section>
</main>`
  });
}

function renderMatchCard(match, basePath = "") {
  return `<a class="match-card" href="${basePath}matches/${match.fileName}" data-search="${searchText([match.date, match.plainLabel, match.resultLabel, match.statusLabel, match.entries, match.stake, match.net])}">
    <div class="match-card-top">${statusChip(match.statusLabel)}<span>${displayDate(match.date)}</span></div>
    <div class="match-card-teams">${escapeHtml(match.label)}</div>
    <div class="match-card-meta">${escapeHtml(match.resultLabel)} · ${match.entries} entries · ${money(match.stake)} bet</div>
    <strong class="${toneClass(match.net)}">${money(match.net)}</strong>
  </a>`;
}

function renderSelectedMatch(match, basePath) {
  return `<section class="panel selected-panel">
    <div class="selected-title">
      <div>
        <span class="section-icon">⚽</span>
        <h2>${escapeHtml(match.plainLabel)}</h2>
      </div>
      ${statusChip(match.resultLabel)}
    </div>
    ${renderBetTable(match.settledBets.slice(0, 2), "selected-match", basePath)}
    <a class="full-width-link" href="${basePath}matches/${match.fileName}">View all ${match.entries} entries<span class="down-caret"></span></a>
  </section>`;
}

function renderMatchPage(match) {
  const stats = matchStats(match);
  return htmlPage({
    title: `FIFA 2026 ${stats.plainLabel}`,
    active: "",
    basePath: "../",
    body: `
<main>
  <section class="panel page-panel">
    <div class="detail-hero">
      <div>
        <a class="back-link" href="../calendar.html">Back to Calendar</a>
        <h2>${escapeHtml(stats.label)}</h2>
        <p>${displayDate(stats.date)} · ${escapeHtml(stats.resultLabel)} · ${escapeHtml(stats.statusLabel)}</p>
      </div>
      <strong class="${toneClass(stats.net)}">${money(stats.net)}</strong>
    </div>
    ${renderKpiGrid([
      ["Entries", stats.entries, "clipboard"],
      ["RM Bet", money(stats.stake), "wallet"],
      ["Potential / Payout", money(stats.isCompleted ? stats.actualPayout : sum(stats.settledBets, "displayPayout")), "payout"],
      ["Net", money(stats.net), "trend", toneClass(stats.net)]
    ])}
    ${renderBetTable(stats.settledBets, "match-bets", "../")}
  </section>
</main>`
  });
}

function renderBetTable(betsForMatch, filterId, basePath = "") {
  return `<div class="table-wrap"><table class="data-table bet-table" data-filter-table="${filterId}">
    <thead><tr><th>Bettor</th><th>Pick</th><th class="num">Rate</th><th class="num">RM Bet</th><th>Status</th><th class="num">Payout / Potential</th><th class="num">Net</th></tr></thead>
    <tbody>${betsForMatch.map((bet) => renderBetRow(bet, basePath)).join("")}</tbody>
  </table></div>`;
}

function renderBetRow(bet) {
  return `<tr data-search="${searchText([bet.bettor, bet.pick, bet.status, bet.odds, bet.stake, bet.displayPayout, bet.net])}">
    <td><span class="avatar avatar-small">${escapeHtml(bet.bettor.slice(0, 1))}</span>${escapeHtml(bet.bettor)}</td>
    <td>${escapeHtml(bet.pick)}</td>
    <td class="num">${odds(bet.odds)}</td>
    <td class="num">${money(bet.stake)}</td>
    <td>${statusChip(bet.status)}</td>
    <td class="num">${money(bet.displayPayout)}</td>
    <td class="num ${toneClass(bet.net)}">${money(bet.net)}</td>
  </tr>`;
}

function renderBettorPage(bettor) {
  return htmlPage({
    title: `FIFA 2026 ${bettor.name}`,
    active: "",
    basePath: "../",
    body: `
<main>
  <section class="panel page-panel">
    <div class="detail-hero">
      <div>
        <a class="back-link" href="../index.html">Back to Summary</a>
        <h2>${escapeHtml(bettor.name)}</h2>
        <p>${bettor.entries} entries · ${money(bettor.stake)} bet · ${money(bettor.payout)} payout</p>
      </div>
      <strong class="${toneClass(bettor.net)}">${money(bettor.net)}</strong>
    </div>
    ${renderKpiGrid([
      ["Entries", bettor.entries, "clipboard"],
      ["RM Bet", money(bettor.stake), "wallet"],
      ["Payout", money(bettor.payout), "payout"],
      ["Net", money(bettor.net), "trend", toneClass(bettor.net)]
    ])}
    <div class="section-head section-head-tools">
      <div><span class="section-icon">📋</span><h2>Bet History</h2></div>
      <label class="search-box"><span>Search</span><input type="search" placeholder="Search bets..." data-filter-input data-filter-target="bettor-bets"></label>
    </div>
    <div class="table-wrap"><table class="data-table" data-filter-table="bettor-bets">
      <thead><tr><th>Date</th><th>Match</th><th>Pick</th><th class="num">Rate</th><th class="num">RM Bet</th><th>Result</th><th>Status</th><th class="num">Payout</th><th class="num">Net</th></tr></thead>
      <tbody>${bettor.bets.map(renderBettorBetRow).join("")}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="num">${money(bettor.stake)}</td><td></td><td></td><td class="num">${money(bettor.payout)}</td><td class="num ${toneClass(bettor.net)}">${money(bettor.net)}</td></tr></tfoot>
    </table></div>
  </section>
</main>`
  });
}

function renderBettorBetRow(bet) {
  return `<tr data-search="${searchText([bet.date, bet.matchPlainLabel, bet.pick, bet.status, bet.resultLabel, bet.odds, bet.stake, bet.net])}">
    <td>${displayDate(bet.date)}</td>
    <td><a class="match-cell" href="../matches/${bet.matchFileName}">${escapeHtml(bet.matchLabel)}</a></td>
    <td>${escapeHtml(bet.pick)}</td>
    <td class="num">${odds(bet.odds)}</td>
    <td class="num">${money(bet.stake)}</td>
    <td>${escapeHtml(bet.resultLabel)}</td>
    <td>${statusChip(bet.status)}</td>
    <td class="num">${money(bet.actualPayout)}</td>
    <td class="num ${toneClass(bet.net)}">${money(bet.net)}</td>
  </tr>`;
}

function htmlPage({ title, active = "", basePath = "", summary = null, body }) {
  const logoUrl = assetUrl(basePath, FIFA_2026_LOGO_URL);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title><link rel="icon" href="${logoUrl}"><link rel="apple-touch-icon" href="${logoUrl}"><meta name="apple-mobile-web-app-title" content="FIFA Tracker"><link rel="stylesheet" href="${basePath}assets/style.css?v=${STYLE_VERSION}"></head>
<body>
<div class="app-shell">
<header class="site-header">
  <div class="brand-scene">
    <a class="brand" href="${basePath}index.html">
      <img src="${logoUrl}" alt="FIFA World Cup 26 mark">
      <span><b>FIFA 2026</b><strong>Bets Tracker</strong></span>
    </a>
    <div class="we-are">WE<br>ARE<br>26</div>
  </div>
  ${nav(active, basePath)}
</header>
${body}
</div>
<script src="${basePath}assets/app.js"></script>
</body></html>`;
}

function nav(active, basePath) {
  const items = [["index", "index.html", "Summary"], ["calendar", "calendar.html", "Calendar"], ["completed", "completed.html", "Completed"], ["ongoing", "ongoing.html", "On Going"]];
  return `<nav class="nav">${items.map(([key, href, label]) => `<a class="${active === key ? "is-active" : ""}" href="${basePath}${href}">${label}</a>`).join("")}</nav>`;
}

function statusChip(value) {
  const text = String(value || "");
  const key = text.toLowerCase();
  let tone = "neutral";
  if (key.includes("win") || key.includes("completed") || key.includes("final")) tone = "good";
  if (key.includes("lose")) tone = "bad";
  if (key.includes("pending") || key.includes("going")) tone = "pending";
  if (key.includes("push")) tone = "push";
  return `<span class="status status-${tone}">${escapeHtml(text)}</span>`;
}

function teamFlag(team) { return TEAM_FLAGS[team] || "🏳️"; }
function rankLabel(index) { return ["🏆", "🥈", "🥉"][index] || String(index + 1); }
function flagBadge(team) { return `<span class="flag-badge flag-${slugify(team)}" aria-label="${escapeHtml(team)}"><span>${teamFlag(team)}</span></span>`; }
function teamLabel(team) { return `${teamFlag(team)} ${team}`; }
function matchLabel(homeTeam, awayTeam) { return `${teamLabel(homeTeam)} vs ${teamLabel(awayTeam)}`; }
function displayDate(isoDate) { const [year, month, day] = isoDate.split("-"); return `${day}/${month}/${year}`; }
function displayDateShort(isoDate) { const [year, month, day] = isoDate.split("-"); return `${day}/${month}<br>/${year}`; }
function dateSlug(isoDate) { const [year, month, day] = isoDate.split("-"); return `${day}-${month}-${year}`; }
function slugify(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function sum(entries, field) { return roundMoney(entries.reduce((total, entry) => total + entry[field], 0)); }
function roundMoney(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function money(value) { return `RM${roundMoney(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function moneyShort(value) { return `RM${roundMoney(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`; }
function odds(value) { return Number(value).toFixed(2); }
function toneClass(value) { if (value > 0) return "good"; if (value < 0) return "bad"; return "neutral"; }
function assetUrl(basePath, url) { return /^https?:\/\//.test(url) ? url : `${basePath}${url}`; }
function searchText(values) { return escapeHtml(values.filter((value) => value !== undefined && value !== null).join(" ").toLowerCase()); }
function escapeHtml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
