const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const EXTRA_BETS_DIR = path.join(DATA_DIR, "extra-bets");
const BUILD_SITE_PATH = path.join(__dirname, "build-site.js");

patchResults();
mergeExtraBets();
patchBettorOrder();

function patchResults() {
  const resultsPath = path.join(DATA_DIR, "results.json");
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const patches = [
    {
      matchId: "2026-06-30-france-vs-sweden",
      finalScore: "3-0",
      aos: false
    }
  ];
  let changed = false;

  for (const patch of patches) {
    const index = results.findIndex((result) => result.matchId === patch.matchId);
    if (index === -1) {
      results.push(patch);
      changed = true;
    } else if (JSON.stringify(results[index]) !== JSON.stringify(patch)) {
      results[index] = patch;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n");
    console.log("Patched latest match results.");
  }
}

function mergeExtraBets() {
  const betsPath = path.join(DATA_DIR, "bets.json");
  const baseBets = JSON.parse(fs.readFileSync(betsPath, "utf8"));
  const correctedBaseBets = baseBets.filter((bet) => (
    !isWrongPortugalUrisBet(bet) &&
    !isWrongNorwaySenegalMirrorBet(bet)
  ));
  const allBets = [...correctedBaseBets];
  const indexByKey = new Map();
  correctedBaseBets.forEach((bet, index) => {
    indexByKey.set(betKey(bet), index);
  });

  if (fs.existsSync(EXTRA_BETS_DIR)) {
    for (const fileName of fs.readdirSync(EXTRA_BETS_DIR).sort()) {
      if (!fileName.endsWith(".json")) continue;
      const filePath = path.join(EXTRA_BETS_DIR, fileName);
      const extraBets = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!Array.isArray(extraBets)) {
        throw new Error(`${fileName} must contain a JSON array of bet entries.`);
      }
      for (const rawBet of extraBets) {
        const bet = withManualSettlements(rawBet);
        const key = betKey(bet);
        if (indexByKey.has(key)) {
          allBets[indexByKey.get(key)] = bet;
        } else {
          indexByKey.set(key, allBets.length);
          allBets.push(bet);
        }
      }
    }
  }

  fs.writeFileSync(betsPath, JSON.stringify(allBets, null, 2) + "\n");
  console.log(`Prepared ${allBets.length} total betting entries.`);
}

function withManualSettlements(bet) {
  if (bet.ticketId === "HDP8242002345" && bet.matchId === "2026-06-30-france-vs-sweden") {
    return {
      ...bet,
      manualSettlement: {
        status: "Win",
        displayPayout: 184,
        actualPayout: 184,
        net: 84
      }
    };
  }

  return bet;
}

function isWrongPortugalUrisBet(bet) {
  return (
    bet.matchId === "2026-06-18-portugal-vs-dr-congo" &&
    bet.bettor === "URIS" &&
    Number(bet.stake) === 5 &&
    (
      (bet.pick === "1-1" && Number(bet.odds) === 11) ||
      (bet.pick === "2-1" && Number(bet.odds) === 9.2) ||
      (bet.pick === "0-1" && Number(bet.odds) === 24)
    )
  );
}

function isWrongNorwaySenegalMirrorBet(bet) {
  if (bet.matchId !== "2026-06-22-norway-vs-senegal" || bet.pick !== "3-2") {
    return false;
  }

  return (
    (bet.bettor === "URIS" && Number(bet.odds) === 1.95 && Number(bet.stake) === 120) ||
    (bet.bettor === "Kaizo" && Number(bet.odds) === 1.97 && Number(bet.stake) === 100)
  );
}

function betKey(bet) {
  if (bet.ticketId) {
    return [
      bet.matchId,
      bet.bettor,
      bet.ticketId
    ].join("|");
  }

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

function patchBettorOrder() {
  if (!fs.existsSync(BUILD_SITE_PATH)) return;

  const previous = 'const BETTOR_ORDER = ["Kaizo", "Thomas", "Zac", "Eric", "TSL", "URIS"];';
  const next = 'const BETTOR_ORDER = ["Kaizo", "Thomas", "Zac", "Eric", "URIS"];';
  const content = fs.readFileSync(BUILD_SITE_PATH, "utf8");

  if (content.includes(previous)) {
    fs.writeFileSync(BUILD_SITE_PATH, content.replace(previous, next));
    console.log("Removed TSL from bettor order.");
  }
}
