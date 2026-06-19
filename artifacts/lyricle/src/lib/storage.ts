export interface DailyState {
  puzzleNumber: number;
  date: string;
  stagesRevealed: number;
  guesses: Array<{ artist: string; title: string; correct: boolean; hint: string | null }>;
  completed: boolean;
  won: boolean;
  startTimeMs: number;
  resultSubmitted: boolean;
  solveTimeMs?: number | null;
  country?: string | null;
  pointsEarned?: number | null;
  retryUsed?: boolean;
}

export interface PlayerData {
  playerId: string;
  displayName: string;
  country?: string;
}

export const getDailyState = (puzzleNumber: number): DailyState | null => {
  const saved = localStorage.getItem(`lyricle_state_${puzzleNumber}`);
  return saved ? JSON.parse(saved) : null;
};

export const saveDailyState = (puzzleNumber: number, state: DailyState) => {
  localStorage.setItem(`lyricle_state_${puzzleNumber}`, JSON.stringify(state));
};

export const getPlayerData = (): PlayerData => {
  const saved = localStorage.getItem("lyricle_player");
  if (saved) return JSON.parse(saved);

  const newData: PlayerData = {
    playerId: crypto.randomUUID(),
    displayName: "",
  };
  localStorage.setItem("lyricle_player", JSON.stringify(newData));
  return newData;
};

export const savePlayerData = (data: PlayerData) => {
  localStorage.setItem("lyricle_player", JSON.stringify(data));
};

export const hasSeenTutorial = (): boolean => {
  return localStorage.getItem("lyricle_seen_tutorial") === "true";
};

export const setSeenTutorial = () => {
  localStorage.setItem("lyricle_seen_tutorial", "true");
};
