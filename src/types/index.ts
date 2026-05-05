export type Color =
  | 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'
  | 'cyan' | 'pink' | 'brown' | 'white' | 'lime' | 'magenta'
  | 'teal' | 'gold' | 'navy';

export enum ColorId {
  EMPTY = 0,
  RED = 1,
  BLUE = 2,
  GREEN = 3,
  YELLOW = 4,
  ORANGE = 5,
  PURPLE = 6,
  CYAN = 7,
  PINK = 8,
  BROWN = 9,
  WHITE = 10,
  LIME = 11,
  MAGENTA = 12,
  TEAL = 13,
  GOLD = 14,
  NAVY = 15,
  WALL = 255
}

export const COLOR_LIST: Color[] = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'cyan', 'pink', 'brown', 'white', 'lime', 'magenta',
  'teal', 'gold', 'navy'
];

export const COLOR_NAMES: Record<number, string> = {
  [ColorId.EMPTY]: 'empty',
  [ColorId.RED]: 'red',
  [ColorId.BLUE]: 'blue',
  [ColorId.GREEN]: 'green',
  [ColorId.YELLOW]: 'yellow',
  [ColorId.ORANGE]: 'orange',
  [ColorId.PURPLE]: 'purple',
  [ColorId.CYAN]: 'cyan',
  [ColorId.PINK]: 'pink',
  [ColorId.BROWN]: 'brown',
  [ColorId.WHITE]: 'white',
  [ColorId.LIME]: 'lime',
  [ColorId.MAGENTA]: 'magenta',
  [ColorId.TEAL]: 'teal',
  [ColorId.GOLD]: 'gold',
  [ColorId.NAVY]: 'navy',
  [ColorId.WALL]: 'WALL'
};

export type CellType = 'empty' | 'dot' | 'wall' | 'mixer' | 'teleport' | 'lock';

export type Mechanic =
  | 'wall' | 'mixer' | 'teleport' | 'lock'
  | 'shaped_grid' | 'speed' | 'chain_mixer'
  | 'multi_teleport' | 'gravity';

export type DiffLabel = 'trivial' | 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'legendary';

export interface Cell {
  row: number;
  col: number;
  type: CellType;
  isActive: boolean;
  dotColor?: Color;
  pathColor?: Color;
  isFilled: boolean;
  mixerInputA?: Color;
  mixerInputB?: Color;
  mixerOutput?: Color;
  mixerFilledA: boolean;
  mixerFilledB: boolean;
  teleportId?: string;
  teleportTarget?: [number, number];
  lockId?: string;
  lockedBy?: Color;
  isLocked: boolean;
}

export interface GamePath {
  color: Color;
  cells: [number, number][];
  isComplete: boolean;
}

export interface DotPair {
  color: Color;
  start: [number, number];
  end: [number, number];
}

export interface MixerDef {
  pos: [number, number];
  inputA: Color;
  inputB: Color;
  output: Color;
}

export interface TeleportDef {
  id: string;
  pos: [number, number];
  teleportTarget?: [number, number];
}

export interface LockDef {
  id: string;
  pos: [number, number];
  unlockedByColor: Color;
}

export interface SolutionPath {
  color: Color;
  path: [number, number][];
}



export interface LevelData {
  id: string;
  gridSize: number;
  globalIndex: number;
  pairs: DotPair[];
  walls: [number, number][];
  mixers: MixerDef[];
  teleports: TeleportDef[];
  locks: LockDef[];
  shapeMask?: boolean[][];
  solution: SolutionPath[];
  difficultyScore: number;
  difficultyLabel: DiffLabel;
  par: number;
  estimatedSolveTime: number;
  mechanics: Mechanic[];
}

export interface LevelMetadata {
  id: string;
  gridSize: number;
  globalIndex: number;
  pairs: DotPair[];
  difficultyScore: number;
  difficultyLabel: DiffLabel;
  par: number;
  mechanics: Mechanic[];
}

export interface GameSession {
  levelId: string;
  startTime: number;
  moves: number;
  hintsUsed: number;
  undosUsed: number;
  restarts: number;
  adsWatchedForHint: number;
  adsWatchedForUndo: number;
  isComplete: boolean;
  completionTime?: number;
}

export interface PerformanceRecord {
  levelId: string;
  gridSize: number;
  difficultyScore: number;
  performanceScore: number;
  timestamp: number;
}

export interface AdaptationState {
  trend: SkillTrend;
  consecutiveEasyWins: number;
  consecutiveHardFails: number;
}

export type SkillTrend = 'rising' | 'stable' | 'falling';

export interface PlayerProfile {
  skillLevel: number;
  performanceHistory: PerformanceRecord[];
  currentGridSize: number;
  highestUnlockedGrid: number;
  totalLevelsCompleted: number;
  streakDays: number;
  lastPlayDate: string;
  adaptationState: AdaptationState;
}

export interface HintResult {
  color: Color;
  nextCell: [number, number];
  extendedHint: [number, number][];
}

export interface GameState {
  level: LevelData;
  paths: GamePath[];
  grid: Cell[][];
}
