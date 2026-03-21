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
  const linkQuality = Number(session.extra_data?.linkQuality ?? session.protection_level ?? 0);
  const packetLoss = Number(session.extra_data?.packetLoss ?? 0);
  const throughput = Number(session.extra_data?.throughput ?? 0);
  const latencyMs = Number(session.extra_data?.latencyMs ?? 0);
  const deliveredPackets = Number(session.extra_data?.deliveredPackets ?? 0);
  const stableHoldSeconds = Number(session.extra_data?.stableHoldSeconds ?? 0);
  const stableTargetSeconds = Number(session.extra_data?.stableTargetSeconds ?? 8);

  return (
    <div className="experience-grid">
      <section className="panel hero-panel">
        <div className="panel-header">
          <p className="eyebrow">{success ? "Соединение восстановлено" : "Линия не удержала поток"}</p>
          <h2>
            {success ? "Пакеты снова уверенно дошли до верхнего выхода" : "Нижние секции продолжали отравлять магистраль"}
          </h2>
          <p className="lead">
            {success
              ? "Связь считалась восстановленной, когда поток удержался в стабильном состоянии без критических срывов."
              : session.failure_reason ?? "Поток остался слишком редким и рваным для устойчивой связи."}
          </p>
        </div>

        <div className="result-metrics">
          <article>
            <span>Счёт</span>
            <strong>{session.score}</strong>
          </article>
          <article>
            <span>Качество линии</span>
            <strong>{linkQuality}%</strong>
          </article>
          <article>
            <span>Место</span>
            <strong>#{rank}</strong>
          </article>
          <article>
            <span>Длительность</span>
            <strong>{formatSeconds(session.duration_seconds)}</strong>
          </article>
          <article>
            <span>Потери</span>
            <strong>{packetLoss}%</strong>
          </article>
          <article>
            <span>Латентность</span>
            <strong>{latencyMs} мс</strong>
          </article>
          <article>
            <span>Поток</span>
            <strong>{throughput}%</strong>
          </article>
          <article>
            <span>Дошло пакетов</span>
            <strong>{deliveredPackets}</strong>
          </article>
          <article>
            <span>Окно стабильности</span>
            <strong>
              {stableHoldSeconds}/{stableTargetSeconds} сек
            </strong>
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
