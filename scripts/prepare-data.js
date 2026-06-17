const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const EXTRA_BETS_DIR = path.join(DATA_DIR, "extra-bets");
const BUILD_SITE_PATH = path.join(__dirname, "build-site.js");

mergeExtraBets();
patchTeamFlags();

function mergeExtraBets() {
  const betsPath = path.join(DATA_DIR, "bets.json");
  const baseBets = JSON.parse(fs.readFileSync(betsPath, "utf8"));
  const allBets = [...baseBets];
  const seen = new Set(baseBets.map(betKey));

  if (fs.existsSync(EXTRA_BETS_DIR)) {
    for (const fileName of fs.readdirSync(EXTRA_BETS_DIR).sort()) {
      if (!fileName.endsWith(".json")) continue;
      const filePath = path.join(EXTRA_BETS_DIR, fileName);
      const extraBets = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!Array.isArray(extraBets)) {
        throw new Error(`${fileName} must contain a JSON array of bet entries.`);
      }
      for (const bet of extraBets) {
        const key = betKey(bet);
        if (!seen.has(key)) {
          allBets.push(bet);
          seen.add(key);
        }
      }
    }
  }

  fs.writeFileSync(betsPath, JSON.stringify(allBets, null, 2) + "\n");
  console.log(`Prepared ${allBets.length} total betting entries.`);
}

function betKey(bet) {
  return [
    bet.matchId,
    bet.date,
    bet.homeTeam,
    bet.awayTeam,
    bet.bettor,
    bet.pick,
    Number(bet.odds).toFixed(2),
    Number(bet.stake).toFixed(2)
  ].join("|");
}

function patchTeamFlags() {
  if (!fs.existsSync(BUILD_SITE_PATH)) return;
  let content = fs.readFileSync(BUILD_SITE_PATH, "utf8");
  const additions = [
    ["England", "🏴"],
    ["Croatia", "🇭🇷"],
    ["Portugal", "🇵🇹"],
    ["DR Congo", "🇨🇩"]
  ];

  let changed = false;
  for (const [team, flag] of additions) {
    if (content.includes(`"${team}":`)) continue;
    content = content.replace(/(\s+"Jordan": "🇯🇴")/, `$1,\n  "${team}": "${flag}"`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(BUILD_SITE_PATH, content);
    console.log("Patched build-site.js with new country flags.");
  }
}
