export const DEFAULT_ELO = 400;
const ELO_DELTA = 15;
const MIN_ELO = 0;

export function getNewElo(currentElo: number, didWin: boolean): number {
  const next = didWin ? currentElo + ELO_DELTA : currentElo - ELO_DELTA;
  return Math.max(MIN_ELO, next);
}

export function getRank(elo: number): string {
  if (elo >= 1000) return "Packgod";
  if (elo >= 900) return "Final Boss";
  if (elo >= 800) return "Aura Farmer";
  if (elo >= 700) return "Lowkey Rizz";
  if (elo >= 600) return "Mid Aura";
  if (elo >= 500) return "Cooked";
  return "NPC";
}
