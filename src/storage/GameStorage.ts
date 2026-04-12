import type { PlayerProfile, PerformanceRecord } from '../types';

const STORAGE_KEY_PROFILE = 'colorflow_profile';
const STORAGE_KEY_COMPLETED = 'colorflow_completed';
const STORAGE_KEY_LAST_AD = 'colorflow_last_interstitial';

const DEFAULT_PROFILE: PlayerProfile = {
  skillLevel: 0,
  performanceHistory: [],
  currentGridSize: 3,
  highestUnlockedGrid: 3,
  totalLevelsCompleted: 0,
  streakDays: 0,
  lastPlayDate: '',
  adaptationState: {
    trend: 'stable',
    consecutiveEasyWins: 0,
    consecutiveHardFails: 0,
  },
};

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    // corrupted data, use defaults
  }
  return { ...DEFAULT_PROFILE };
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch {
    // storage full or unavailable
  }
}

export function recordPerformance(profile: PlayerProfile, record: PerformanceRecord): PlayerProfile {
  const history = [...profile.performanceHistory, record].slice(-10);
  return { ...profile, performanceHistory: history };
}

export function markLevelCompleted(levelId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
    const completed: string[] = raw ? JSON.parse(raw) : [];
    if (!completed.includes(levelId)) {
      completed.push(levelId);
      localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(completed));
    }
  } catch {
    // ignore
  }
}

export function getCompletedLevels(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

export function saveLastInterstitialTime(): void {
  localStorage.setItem(STORAGE_KEY_LAST_AD, Date.now().toString());
}

export function getLastInterstitialTime(): number {
  const raw = localStorage.getItem(STORAGE_KEY_LAST_AD);
  return raw ? parseInt(raw, 10) : 0;
}

export function updateStreak(profile: PlayerProfile): PlayerProfile {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.lastPlayDate === today) return profile;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = profile.lastPlayDate === yesterday ? profile.streakDays + 1 : 1;

  return { ...profile, streakDays: newStreak, lastPlayDate: today };
}
