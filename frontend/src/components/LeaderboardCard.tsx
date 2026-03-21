import { formatDate } from "../lib/format";
import type { LeaderboardEntry } from "../types";

interface LeaderboardCardProps {
  items: LeaderboardEntry[];
  title?: string;
}

export function LeaderboardCard({ items, title = "Рейтинг защиты" }: LeaderboardCardProps) {
  return (
    <section className="panel leaderboard-card">
      <div className="panel-header">
        <p className="eyebrow">{title}</p>
        <h3>Лучшие результаты стенда</h3>
      </div>
      <div className="leaderboard-list">
        {items.length === 0 ? (
          <p className="muted">Первые результаты появятся после завершения партии.</p>
        ) : (
          items.map((item, index) => (
            <article key={item.session_id} className="leaderboard-item">
              <span className="leaderboard-rank">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{item.full_name}</p>
                <small>{formatDate(item.completed_at)}</small>
              </div>
              <strong>{item.score}</strong>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
