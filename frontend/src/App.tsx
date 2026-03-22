import { Suspense, lazy } from "react";

import { resolveAppPage } from "./app/routing";
import { GameExperience } from "./pages/GameExperience";

const AdminPage = lazy(async () => {
  const module = await import("./pages/AdminPage");
  return { default: module.AdminPage };
});

function AppLoader() {
  return (
    <main className="app-shell admin-shell">
      <div className="app-backdrop" />
      <div className="app-content">
        <section className="panel admin-login-panel">
          <div className="panel-header">
            <p className="eyebrow">Загрузка</p>
            <h1>Подготавливаем интерфейс</h1>
            <p className="lead">Загружаем нужный экран без лишнего кода.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const page = resolveAppPage(window.location.pathname);

  if (page === "admin") {
    return (
      <Suspense fallback={<AppLoader />}>
        <AdminPage />
      </Suspense>
    );
  }

  return <GameExperience />;
}
