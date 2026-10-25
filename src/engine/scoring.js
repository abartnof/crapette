// Tournament scoring and multi-deal match ledger for Crapette (Russian Bank)

/**
 * Calculates tournament points at the end of a deal.
 * - Winner bonus: 30 points
 * - Loser reserve penalty: 2 points per card remaining in loser's reserve
 * - Loser stock & waste penalty: 1 point per card remaining in loser's stock and waste
 *
 * @param {object} gameOrState - CrapetteGame instance or state object
 * @returns {object} Deal score breakdown
 */
export function calculateDealScore(gameOrState) {
  const state = typeof gameOrState.state === "function" ? gameOrState.state() : gameOrState;
  const winner = state.winner ?? (gameOrState.winner ?? null);

  if (winner === null || winner === undefined) {
    throw new Error("Cannot calculate deal score: no winner declared.");
  }

  const loser = 1 - winner;
  const loserPlayer = state.players[loser];

  const getCount = (arr, countProp) => {
    if (typeof countProp === "number") return countProp;
    if (Array.isArray(arr)) return arr.length;
    return 0;
  };

  const reserveCount = getCount(loserPlayer.reserve, loserPlayer.reserveCount);
  const stockCount = getCount(loserPlayer.stock, loserPlayer.stockCount);
  const wasteCount = getCount(loserPlayer.waste, loserPlayer.wasteCount);

  const winnerBonus = 30;
  const reservePenalty = reserveCount * 2;
  const stockWastePenalty = (stockCount + wasteCount) * 1;
  const totalPoints = winnerBonus + reservePenalty + stockWastePenalty;

  const dealScores = [0, 0];
  dealScores[winner] = totalPoints;

  return {
    winner,
    loser,
    winnerBonus,
    reservePenalty,
    stockWastePenalty,
    totalPoints,
    dealScores,
  };
}

/**
 * Multi-deal tournament match ledger tracking cumulative points across deals.
 */
export class MatchLedger {
  constructor() {
    this.deals = [];
    this.totals = [0, 0];
  }

  get dealCount() {
    return this.deals.length;
  }

  get leader() {
    if (this.totals[0] > this.totals[1]) return 0;
    if (this.totals[1] > this.totals[0]) return 1;
    return null;
  }

  recordDeal(dealResult) {
    const scores = dealResult.dealScores ?? (
      dealResult.winner === 0 ? [dealResult.totalPoints, 0] : [0, dealResult.totalPoints]
    );

    const record = {
      dealNumber: this.deals.length + 1,
      ...dealResult,
      dealScores: scores,
      cumulativeTotals: [this.totals[0] + scores[0], this.totals[1] + scores[1]],
    };

    this.deals.push(record);
    this.totals[0] += scores[0];
    this.totals[1] += scores[1];

    return record;
  }

  isMatchOver(targetScore = 100) {
    return this.totals[0] >= targetScore || this.totals[1] >= targetScore;
  }

  reset() {
    this.deals = [];
    this.totals = [0, 0];
  }
}
