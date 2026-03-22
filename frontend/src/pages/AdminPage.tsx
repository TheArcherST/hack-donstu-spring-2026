import { useEffect, useState, type FormEvent } from "react";

import { downloadAdminCsv, fetchAdminEntries, togglePrizeIssued } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AdminEntry } from "../types";

type TimeWindowUnit = "hours" | "days" | "weeks";

const DEFAULT_WINDOW_VALUE = "24";
const WINDOW_UNIT_MULTIPLIER: Record<TimeWindowUnit, number> = {
  hours: 1,
  days: 24,
  weeks: 24 * 7,
};
const WINDOW_UNIT_LABEL: Record<TimeWindowUnit, string> = {
  hours: "ч",
  days: "дн",
  weeks: "нед",
};

function normalizeWindowValue(windowValue: string) {
  const parsedValue = Number.parseInt(windowValue, 10);
  return Number.isNaN(parsedValue) || parsedValue < 1 ? 24 : parsedValue;
}

function resolveWindowHours(windowValue: string, windowUnit: TimeWindowUnit, allTime: boolean) {
  if (allTime) {
    return 0;
  }

  return normalizeWindowValue(windowValue) * WINDOW_UNIT_MULTIPLIER[windowUnit];
}

function buildAdminParams({
  search,
  sortBy,
  sortDir,
  winnersOnly,
  windowValue,
  windowUnit,
  allTime,
}: {
  search: string;
  sortBy: string;
  sortDir: string;
  winnersOnly: boolean;
  windowValue: string;
  windowUnit: TimeWindowUnit;
  allTime: boolean;
}) {
  const params = new URLSearchParams({
    sort_by: sortBy,
    sort_dir: sortDir,
    window_hours: String(resolveWindowHours(windowValue, windowUnit, allTime)),
  });

  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (winnersOnly) {
    params.set("winners_only", "true");
  }

  return params;
}

export function AdminPage() {
  const [items, setItems] = useState<AdminEntry[]>([]);
  const [passwordInput, setPasswordInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [windowValue, setWindowValue] = useState(DEFAULT_WINDOW_VALUE);
  const [windowUnit, setWindowUnit] = useState<TimeWindowUnit>("hours");
  const [allTime, setAllTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminPassword) {
      setItems([]);
      setLoading(false);
      return;
    }

    const params = buildAdminParams({
      search,
      sortBy,
      sortDir,
      winnersOnly,
      windowValue,
      windowUnit,
      allTime,
    });

    setLoading(true);
    fetchAdminEntries(params, adminPassword)
      .then((response) => {
        setItems(response.items);
        setError(null);
        setAuthError(null);
      })
      .catch((requestError: Error) => {
        if (requestError.message.includes("пароль админки")) {
          setAdminPassword("");
          setItems([]);
          setAuthError(requestError.message);
          setError(null);
          return;
        }
        setError(requestError.message);
      })
      .finally(() => {
        setLoading(false);
        setAuthSubmitting(false);
      });
  }, [adminPassword, search, sortBy, sortDir, winnersOnly, windowValue, windowUnit, allTime]);

  const adminParams = buildAdminParams({
    search,
    sortBy,
    sortDir,
    winnersOnly,
    windowValue,
    windowUnit,
    allTime,
  });
  const safeWindowValue = normalizeWindowValue(windowValue);
  const windowCaption = allTime ? "за всё время" : `за последние ${safeWindowValue} ${WINDOW_UNIT_LABEL[windowUnit]}`;

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPassword = passwordInput.trim();
    if (!trimmedPassword) {
      setAuthError("Введите пароль админки.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    setError(null);
    setAdminPassword(trimmedPassword);
  }

  async function handleTogglePrize(entry: AdminEntry) {
    try {
      await togglePrizeIssued(entry.session_id, !entry.prize_issued, adminPassword);
      setItems((current) =>
        current.map((item) =>
          item.session_id === entry.session_id ? { ...item, prize_issued: !item.prize_issued } : item,
        ),
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось обновить статус приза.";
      if (message.includes("пароль админки")) {
        setAdminPassword("");
        setItems([]);
        setAuthError(message);
        setError(null);
        return;
      }
      setError(message);
    }
  }

  async function handleExportCsv() {
    try {
      setExporting(true);
      await downloadAdminCsv(adminParams, adminPassword);
      setError(null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось выгрузить CSV.";
      if (message.includes("пароль админки")) {
        setAdminPassword("");
        setItems([]);
        setAuthError(message);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setExporting(false);
    }
  }

  function handleLogout() {
    setAdminPassword("");
    setPasswordInput("");
    setItems([]);
    setError(null);
    setAuthError(null);
  }

  if (!adminPassword) {
    return (
      <main className="app-shell admin-shell">
        <div className="app-backdrop" />
        <div className="app-content">
          <section className="panel admin-login-panel">
            <div className="panel-header">
              <p className="eyebrow">Admin Console</p>
              <h1>Вход в админку</h1>
              <p className="lead">Доступ к результатам и выдаче призов открыт только по паролю из `.env`.</p>
            </div>

            <form className="contact-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>Пароль</span>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  aria-invalid={Boolean(authError)}
                  className={authError ? "input-error" : undefined}
                />
              </label>
              {authError ? <p className="error-text inline-error">{authError}</p> : null}
              <button type="submit" className="primary-button" disabled={authSubmitting}>
                {authSubmitting ? "Проверяем..." : "Открыть админку"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
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
            <div className="admin-actions">
              <button type="button" className="secondary-button" onClick={handleExportCsv} disabled={exporting}>
                {exporting ? "Готовим CSV..." : "Экспорт CSV"}
              </button>
              <button type="button" className="secondary-button" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </div>

          <div className="admin-filters">
            <label>
              <span>Телефон</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="+7..." />
            </label>
            <label>
              <span>Сортировка</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="score">По результату</option>
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
            <label>
              <span>Окно</span>
              <input
                type="number"
                min="1"
                value={windowValue}
                disabled={allTime}
                onChange={(event) => setWindowValue(event.target.value)}
              />
            </label>
            <label>
              <span>Единица</span>
              <select
                value={windowUnit}
                disabled={allTime}
                onChange={(event) => setWindowUnit(event.target.value as TimeWindowUnit)}
              >
                <option value="hours">Часы</option>
                <option value="days">Дни</option>
                <option value="weeks">Недели</option>
              </select>
            </label>
            <label className="consent-row compact-row">
              <input checked={winnersOnly} type="checkbox" onChange={(event) => setWinnersOnly(event.target.checked)} />
              <span>Только победители</span>
            </label>
            <label className="consent-row compact-row">
              <input checked={allTime} type="checkbox" onChange={(event) => setAllTime(event.target.checked)} />
              <span>За всё время</span>
            </label>
          </div>

          <p className="muted admin-summary">
            Показаны {items.length} записей {windowCaption}.
          </p>

          {loading ? <p className="muted">Загружаем список...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="muted">По текущим фильтрам записей нет.</p> : null}

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
                  <strong>{item.result_details.network_metrics.packet_loss}%</strong>
                  <small>
                    Loss {item.result_details.network_metrics.packet_loss}% · {item.duration_seconds}с
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
