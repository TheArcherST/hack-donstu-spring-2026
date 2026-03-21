import { formatSeconds } from "../lib/format";
import type { CompletionResult } from "../types";
import { LeaderboardCard } from "./LeaderboardCard";

interface ResultScreenProps {
  result: CompletionResult;
  onReset: () => void;
}

export function ResultScreen({ result, onReset }: ResultScreenProps) {
  const { session, rank, leaderboard } = result;
  const success = session.won;

  return (
    <div className="experience-grid">
      <section className="panel hero-panel">
        <div className="panel-header">
          <p className="eyebrow">{success ? "Соединение восстановлено" : "Канал не выдержал"}</p>
          <h2>
            {success
              ? "DDoS-атака отражена"
              : "Попробуй собрать более устойчивую защиту"}
          </h2>
          <p className="lead">
            {success
              ? "Маршрут удержался под нагрузкой и дошёл до пользователя."
              : session.failure_reason ?? "Защита не успела стабилизировать канал."}
          </p>
        </div>

        <div className="result-metrics">
          <article>
            <span>Счёт</span>
            <strong>{session.score}</strong>
          </article>
          <article>
            <span>Защищённость</span>
            <strong>{session.protection_level}%</strong>
          </article>
          <article>
            <span>Место</span>
            <strong>#{rank}</strong>
          </article>
          <article>
            <span>Длительность</span>
            <strong>{formatSeconds(session.duration_seconds)}</strong>
          </article>
        </div>

        <button type="button" className="primary-button" onClick={onReset}>
          Следующий участник
        </button>
      </section>
      <LeaderboardCard items={leaderboard} title="Актуальный рейтинг" />
    </div>
  );
}
