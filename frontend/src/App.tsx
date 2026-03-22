import { resolveAppPage } from "./app/routing";
import { useLeaderboard } from "./app/useLeaderboard";
import { GameExperience } from "./pages/GameExperience";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  const { leaderboard, leaderboardError, setLeaderboard } = useLeaderboard();
  const page = resolveAppPage(window.location.pathname);

  if (page === "admin") {
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
