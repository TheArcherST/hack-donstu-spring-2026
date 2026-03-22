import type { PacketLossTimelinePoint } from "../types";

interface PacketLossChartProps {
  points: PacketLossTimelinePoint[];
  durationSeconds: number;
  averagePacketLoss: number;
}

const VIEWBOX_WIDTH = 760;
const VIEWBOX_HEIGHT = 280;
const PADDING_LEFT = 54;
const PADDING_RIGHT = 20;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 38;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;

    path += ` C ${midX.toFixed(2)} ${current.y.toFixed(2)}, ${midX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

export function PacketLossChart({ points, durationSeconds, averagePacketLoss }: PacketLossChartProps) {
  const chartWidth = VIEWBOX_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const safeDuration = Math.max(durationSeconds, points[points.length - 1]?.second ?? 0, 1);
  const safePoints = points.length > 0 ? points : [{ second: 0, packet_loss: averagePacketLoss }];
  const projected = safePoints.map((point) => ({
    x: PADDING_LEFT + (clamp(point.second, 0, safeDuration) / safeDuration) * chartWidth,
    y: PADDING_TOP + ((100 - clamp(point.packet_loss, 0, 100)) / 100) * chartHeight,
    value: point.packet_loss,
    second: point.second,
  }));
  const linePath = buildSmoothPath(projected);
  const finalPoint = projected[projected.length - 1];
  const yAxisTicks = [0, 25, 50, 75, 100];
  const xAxisTicks = [0, Math.round(safeDuration / 2), safeDuration];

  return (
    <section className="packet-loss-card">
      <div className="packet-loss-card-header">
        <div>
          <p className="eyebrow">Главная метрика</p>
          <h3>Средние потери пакетов за сессию</h3>
          <p className="muted">Победа и место в рейтинге считаются по итоговому среднему значению за весь матч.</p>
        </div>
        <div className="packet-loss-average-badge">
          <span>Среднее</span>
          <strong>{averagePacketLoss}%</strong>
        </div>
      </div>

      <div className="packet-loss-chart-shell">
        <svg className="packet-loss-chart" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img" aria-label="График средних потерь пакетов за сессию">
          {yAxisTicks.map((tick) => {
            const y = PADDING_TOP + ((100 - tick) / 100) * chartHeight;
            return (
              <g key={tick}>
                <line x1={PADDING_LEFT} y1={y} x2={PADDING_LEFT + chartWidth} y2={y} className="packet-loss-grid-line" />
                <text x={PADDING_LEFT - 10} y={y + 4} textAnchor="end" className="packet-loss-axis-label">
                  {tick}%
                </text>
              </g>
            );
          })}

          {xAxisTicks.map((tick) => {
            const x = PADDING_LEFT + (tick / safeDuration) * chartWidth;
            return (
              <text key={tick} x={x} y={VIEWBOX_HEIGHT - 10} textAnchor={tick === 0 ? "start" : tick === safeDuration ? "end" : "middle"} className="packet-loss-axis-label">
                {tick}с
              </text>
            );
          })}

          <path d={linePath} className="packet-loss-line" />
          <circle cx={finalPoint.x} cy={finalPoint.y} r="6" className="packet-loss-final-dot" />
          <text x={finalPoint.x} y={Math.max(PADDING_TOP + 12, finalPoint.y - 14)} textAnchor="middle" className="packet-loss-final-label">
            {finalPoint.value}%
          </text>
        </svg>
      </div>
    </section>
  );
}
