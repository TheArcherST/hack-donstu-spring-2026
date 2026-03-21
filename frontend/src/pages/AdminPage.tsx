import { useEffect, useState } from "react";

import { exportCsvUrl, fetchAdminEntries, togglePrizeIssued } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AdminEntry } from "../types";

export function AdminPage() {
  const [items, setItems] = useState<AdminEntry[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (winnersOnly) {
      params.set("winners_only", "true");
    }

    setLoading(true);
    fetchAdminEntries(params)
      .then((response) => {
        setItems(response.items);
        setError(null);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [search, sortBy, sortDir, winnersOnly]);

  async function handleTogglePrize(entry: AdminEntry) {
    try {
      await togglePrizeIssued(entry.session_id, !entry.prize_issued);
      setItems((current) =>
        current.map((item) =>
          item.session_id === entry.session_id ? { ...item, prize_issued: !item.prize_issued } : item,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить статус приза.");
    }
  }

  return (
    <main className="app-shell admin-shell">
      <div className="app-backdrop" />
      <div className="app-content">
        <section className="panel admin-panel">
          <div className="panel-header admin-header">
            <div>
              <p className="eyebrow">Admin Console</p>
              <h1>Участники и результаты</h1>
            </div>
            <a className="secondary-button" href={exportCsvUrl()}>
              Экспорт CSV
            </a>
          </div>

          <div className="admin-filters">
            <label>
              <span>Телефон</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="+7..." />
            </label>
            <label>
              <span>Сортировка</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="score">По очкам</option>
                <option value="date">По дате создания</option>
                <option value="completed_at">По завершению</option>
              </select>
            </label>
            <label>
              <span>Направление</span>
              <select value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
                <option value="desc">Сначала новые / большие</option>
                <option value="asc">Сначала старые / меньшие</option>
              </select>
            </label>
            <label className="consent-row compact-row">
              <input checked={winnersOnly} type="checkbox" onChange={(event) => setWinnersOnly(event.target.checked)} />
              <span>Только победители</span>
            </label>
          </div>

          {loading ? <p className="muted">Загружаем список...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <div className="admin-table">
            <div className="admin-table-head">
              <span>Игрок</span>
              <span>Контакты</span>
              <span>Итог</span>
              <span>Статус</span>
              <span>Дата</span>
              <span>Приз</span>
            </div>
            {items.map((item) => (
              <article key={item.session_id} className="admin-row">
                <div>
                  <strong>
                    {item.first_name} {item.last_name}
                  </strong>
                  <small>Session #{item.session_id}</small>
                </div>
                <div>
                  <span>{item.phone}</span>
                  <small>{item.telegram || "Telegram не указан"}</small>
                </div>
                <div>
                  <strong>{item.score}</strong>
                  <small>
                    Защита {item.protection_level}% · {item.duration_seconds}с
                  </small>
                </div>
                <div>
                  <span className={item.won ? "status-pill success" : "status-pill danger"}>
                    {item.won ? "Победа" : "Поражение"}
                  </span>
                  <small>{item.status}</small>
                </div>
                <div>
                  <span>{formatDate(item.completed_at || item.created_at)}</span>
                </div>
                <div>
                  <button type="button" className="secondary-button" onClick={() => handleTogglePrize(item)}>
                    {item.prize_issued ? "Приз выдан" : "Выдать приз"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
