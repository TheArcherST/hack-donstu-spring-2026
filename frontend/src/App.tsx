import { useEffect, useState } from "react";

import { fetchLeaderboard } from "./lib/api";
import { GameExperience } from "./pages/GameExperience";
import { AdminPage } from "./pages/AdminPage";
import type { LeaderboardEntry } from "./types";

export default function App() {
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

  if (window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  return (
    <GameExperience
      initialLeaderboard={leaderboard}
      leaderboardError={leaderboardError}
      onLeaderboardRefresh={setLeaderboard}
    />
  );
}
