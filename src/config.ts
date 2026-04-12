import type { Color, Mechanic, DiffLabel } from './types';

export const COLORS: Color[] = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'cyan', 'pink', 'brown', 'white', 'lime', 'magenta',
  'teal', 'gold', 'navy'
];

export const COLOR_HEX: Record<Color, string> = {
  red: '#E74C3C',
  blue: '#3498DB',
  green: '#2ECC71',
  yellow: '#F1C40F',
  orange: '#E67E22',
  purple: '#9B59B6',
  cyan: '#00BCD4',
  pink: '#E91E63',
  brown: '#795548',
  white: '#ECF0F1',
  lime: '#8BC34A',
  magenta: '#E040FB',
  teal: '#009688',
  gold: '#FFC107',
  navy: '#3F51B5'
};

export const MECHANICS: Mechanic[] = [
  'wall', 'mixer', 'teleport', 'lock',
  'shaped_grid', 'speed', 'chain_mixer',
  'multi_teleport', 'gravity'
];

export const MECHANIC_UNLOCK_GRID: Record<Mechanic, number> = {
  wall: 6,
  mixer: 7,
  teleport: 8,
  lock: 9,
  shaped_grid: 10,
  speed: 11,
  chain_mixer: 12,
  multi_teleport: 13,
  gravity: 14
};

export const LEVEL_COUNTS_BY_GRID: Record<number, number> = {
  3: 3, 4: 5, 5: 10, 6: 18, 7: 28, 8: 40,
  9: 55, 10: 70, 11: 88, 12: 108, 13: 130, 14: 155,
  15: 182, 16: 212, 17: 245, 18: 280, 19: 318, 20: 358
};

export const COLOR_RANGE_BY_GRID: Record<number, [number, number]> = {
  3: [3, 3], 4: [2, 3], 5: [3, 5], 6: [4, 6], 7: [5, 7],
  8: [6, 8], 9: [6, 8], 10: [7, 9], 11: [8, 9], 12: [8, 10],
  13: [9, 11], 14: [10, 12], 15: [11, 13], 16: [11, 13],
  17: [12, 14], 18: [13, 14], 19: [14, 15], 20: [14, 15]
};

export const UNLOCK_THRESHOLDS: Record<number, number> = {
  4: 5, 5: 10, 6: 18, 7: 28, 8: 38, 9: 48,
  10: 55, 11: 62, 12: 68, 13: 72, 14: 76, 15: 80,
  16: 83, 17: 86, 18: 89, 19: 92, 20: 95
};

export const DIFFICULTY_LABELS: { label: DiffLabel; min: number; max: number }[] = [
  { label: 'trivial', min: 0, max: 10 },
  { label: 'easy', min: 11, max: 25 },
  { label: 'medium', min: 26, max: 45 },
  { label: 'hard', min: 46, max: 60 },
  { label: 'expert', min: 61, max: 75 },
  { label: 'master', min: 76, max: 90 },
  { label: 'legendary', min: 91, max: 100 }
];

export const SCORING_WEIGHTS = {
  timeWeight: 0.30,
  hintWeight: 0.25,
  undoWeight: 0.15,
  restartWeight: 0.20,
  efficiencyWeight: 0.10
};

export const MIXER_TABLE: Map<string, Color> = new Map([
  ['red+yellow', 'orange'],
  ['blue+yellow', 'green'],
  ['red+blue', 'purple'],
  ['blue+white', 'cyan'],
  ['red+white', 'pink'],
  ['green+blue', 'teal'],
  ['red+green', 'lime'],
  ['yellow+white', 'gold'],
]);

export function getMixResult(a: Color, b: Color): Color | null {
  const key1 = `${a}+${b}`;
  const key2 = `${b}+${a}`;
  return MIXER_TABLE.get(key1) ?? MIXER_TABLE.get(key2) ?? null;
}

export const GAME_WIDTH = 1080;
export const GAME_HEIGHT = 1920;

export const FREE_HINTS_PER_LEVEL = 2;
export const FREE_UNDOS_PER_LEVEL = 3;

export const INTERSTITIAL_EVERY_N_LEVELS = 5;
export const MIN_INTERSTITIAL_GAP_MS = 180_000;

export const SPEED_MODE_BASE_SECONDS = 90;
export const SPEED_MODE_EXTRA_PER_GRID = 10;
export const SPEED_MODE_WARNING_SECONDS = 15;

export const SKILL_WINDOW_SIZE = 10;
export const SKILL_LEARNING_RATE = 0.15;
export const SKILL_DIFFICULTY_BONUS = 0.3;
