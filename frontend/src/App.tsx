import { resolveAppPage } from "./app/routing";
import { GameExperience } from "./pages/GameExperience";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  const page = resolveAppPage(window.location.pathname);

  if (page === "admin") {
    return <AdminPage />;
  }

  return <GameExperience />;
}
