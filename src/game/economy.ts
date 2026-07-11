/**
 * Post-battle economy. Wins pay full gold plus a win-streak bonus and a small
 * "interest" on saved gold (encourages saving, TFT-style). Losses always pay a
 * small amount so a player is never fully stuck.
 */

export function computeWinGold(stage: number, winStreak: number, savedGold: number): number {
  const base = 5 + Math.floor(stage * 0.5);
  const streakBonus = Math.min(winStreak, 5); // capped
  const interest = Math.min(Math.floor(savedGold / 10), 5); // capped interest
  return base + streakBonus + interest;
}

export function computeLossGold(stage: number): number {
  return 2 + Math.floor(stage * 0.25);
}
