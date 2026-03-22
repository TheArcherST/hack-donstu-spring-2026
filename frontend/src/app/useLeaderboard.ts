import { useEffect, useState } from "react";

import { fetchLeaderboard } from "../lib/api";
import type { LeaderboardEntry } from "../types";

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then((items) => {
        setLeaderboard(items);
        setLeaderboardError(null);
      })
      .catch((error: Error) => {
        setLeaderboardError(error.message);
      });
  }, []);

  return {
    leaderboard,
    leaderboardError,
    setLeaderboard,
  };
}
