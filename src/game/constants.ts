export const BOARD_COLS = 7;
export const BOARD_ROWS = 6;

/** Rows 0-2 belong to the enemy (top), rows 3-5 to the player (bottom). */
export const PLAYER_ROWS = [3, 4, 5] as const;
export const ENEMY_ROWS = [0, 1, 2] as const;

/** Front row for each side (closest to the middle). */
export const PLAYER_FRONT_ROW = 3;
export const ENEMY_FRONT_ROW = 2;

export const BENCH_SIZE = 8;

export const SCHEMA_VERSION = 1;
