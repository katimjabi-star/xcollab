import type { Task } from "@xcollab/core";
import type { BarDatum, DailyCount, DonutData } from "../lib/program-insights.ts";

/* Pure inline-SVG chart primitives for the dashboard widgets. No chart deps;
   every color is a CSS token so light/dark resolve from tokens.css. Each SVG
   is wrapped in dir="ltr" by the caller — chart geometry never mirrors. */

/** Donut segment paint: primary (largest-priority "done") arc is lavender,
    the rest keep the semantic status tokens. */
export const DONUT_COLORS: Record<Task["status"], string> = {
  done: "var(--chart-1)",
  in_progress: "var(--status-in-progress-fg)",
  todo: "var(--status-todo-fg)",
  blocked: "var(--status-blocked-fg)",
};

/** Smallest even axis max ≥ data max (floor 4) → integer ticks 0/mid/max. */
function axisMax(values: number[]): number {
  return Math.max(4, 2 * Math.ceil(Math.max(0, ...values) / 2));
}

function truncate(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Shared plot frame: gridlines + tick numbers + rotated y-axis title. */
function PlotFrame({ max, yTitle }: { max: number; yTitle: string }) {
  const ticks = [0, max / 2, max];
  return (
    <g>
      {ticks.map((tick) => {
        const y = 160 - (tick / max) * 144;
        return (
          <g key={tick}>
            <line className="dash-grid-line" x1={56} x2={548} y1={y} y2={y} />
            <text className="dash-ax dash-num" x={48} y={y + 3} textAnchor="end">
              {tick}
            </text>
          </g>
        );
      })}
      <text className="dash-ax" transform="rotate(-90 14 96)" x={14} y={96} textAnchor="middle">
        {yTitle}
      </text>
    </g>
  );
}

/** Vertical bar chart: value labels above bars, x labels rotated -45°. */
export function BarChart({ data, yTitle }: { data: BarDatum[]; yTitle: string }) {
  const max = axisMax(data.map((d) => d.count));
  const slot = 492 / Math.max(1, data.length);
  const barWidth = Math.min(36, slot * 0.42);
  return (
    <svg className="dash-svg" viewBox="0 0 560 236" role="img" aria-label={yTitle}>
      <PlotFrame max={max} yTitle={yTitle} />
      {data.map((d, i) => {
        const x = 56 + slot * (i + 0.5);
        const h = (d.count / max) * 144;
        return (
          <g key={d.id}>
            <rect
              className="dash-bar"
              x={x - barWidth / 2}
              y={160 - h}
              width={barWidth}
              height={Math.max(h, d.count > 0 ? 2 : 0)}
              rx={2}
            />
            <text className="dash-val dash-num" x={x} y={160 - h - 6} textAnchor="middle">
              {d.count}
            </text>
            <text
              className="dash-ax"
              transform={`rotate(-45 ${x} 174)`}
              x={x}
              y={174}
              textAnchor="end"
            >
              {truncate(d.name)}
            </text>
          </g>
        );
      })}
      <line className="dash-axis-line" x1={56} x2={548} y1={160} y2={160} />
    </svg>
  );
}

/** Donut via stroke-dasharray arcs: big center total, per-arc count labels
    just outside the ring. Zero tasks renders the tinted track alone. */
export function DonutChart({ donut, title }: { donut: DonutData; title: string }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <svg className="dash-svg dash-svg-donut" viewBox="0 0 220 220" role="img" aria-label={title}>
      <circle className="dash-donut-track" cx={110} cy={110} r={r} strokeWidth={26} fill="none" />
      {donut.segments.map((seg) => {
        const start = cumulative;
        cumulative += seg.fraction;
        const mid = 2 * Math.PI * (start + seg.fraction / 2) - Math.PI / 2;
        const lx = 110 + Math.cos(mid) * (r + 27);
        const ly = 110 + Math.sin(mid) * (r + 27) + 4;
        return (
          <g key={seg.status}>
            <circle
              cx={110}
              cy={110}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[seg.status]}
              strokeWidth={26}
              strokeDasharray={`${seg.fraction * c} ${c}`}
              strokeDashoffset={-start * c}
              transform="rotate(-90 110 110)"
            />
            <text className="dash-val dash-num" x={lx} y={ly} textAnchor="middle">
              {seg.count}
            </text>
          </g>
        );
      })}
      <text className="dash-donut-total dash-num" x={110} y={122} textAnchor="middle">
        {donut.total}
      </text>
    </svg>
  );
}

/** Area/line chart over a daily series: filled polygon + point value labels,
    dd/mm x labels rotated -45°. */
export function AreaChart({ data, yTitle }: { data: DailyCount[]; yTitle: string }) {
  const max = axisMax(data.map((d) => d.count));
  const step = 492 / Math.max(1, data.length - 1);
  const points = data.map((d, i) => ({
    x: 56 + step * i,
    y: 160 - (d.count / max) * 144,
    count: d.count,
    label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `56,160 ${line} 548,160`;
  return (
    <svg className="dash-svg" viewBox="0 0 560 236" role="img" aria-label={yTitle}>
      <PlotFrame max={max} yTitle={yTitle} />
      <polygon className="dash-area-fill" points={area} />
      <polyline className="dash-area-line" points={line} fill="none" />
      {points.map((p) => (
        <g key={p.label}>
          <circle className="dash-area-dot" cx={p.x} cy={p.y} r={2.5} />
          <text className="dash-val dash-num" x={p.x} y={p.y - 7} textAnchor="middle">
            {p.count}
          </text>
          <text
            className="dash-ax dash-num"
            transform={`rotate(-45 ${p.x} 176)`}
            x={p.x}
            y={176}
            textAnchor="end"
          >
            {p.label}
          </text>
        </g>
      ))}
      <line className="dash-axis-line" x1={56} x2={548} y1={160} y2={160} />
    </svg>
  );
}
