"use client";

type SeriesPoint = { date: string; portfolio: number; benchmark: number | null };

export function BacktestChart({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) {
    return (
      <p className="text-sm text-[var(--muted)]">Not enough points to chart.</p>
    );
  }

  const w = 720;
  const h = 260;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const vals = series.flatMap((s) =>
    s.benchmark != null ? [s.portfolio, s.benchmark] : [s.portfolio],
  );
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV - minV || 1;
  const yMin = minV - span * 0.05;
  const yMax = maxV + span * 0.05;

  const xAt = (i: number) => padL + (i / (series.length - 1)) * innerW;
  const yAt = (v: number) => padT + ((yMax - v) / (yMax - yMin)) * innerH;

  const portPts = series
    .map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.portfolio).toFixed(1)}`)
    .join(" ");
  const hasBench = series.some((s) => s.benchmark != null);
  const benchPts = hasBench
    ? series
        .map((s, i) =>
          s.benchmark != null
            ? `${xAt(i).toFixed(1)},${yAt(s.benchmark).toFixed(1)}`
            : null,
        )
        .filter(Boolean)
        .join(" ")
    : "";

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xLabels = [
    series[0].date,
    series[Math.floor(series.length / 2)].date,
    series[series.length - 1].date,
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Portfolio vs benchmark equity curve"
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={yAt(v) + 3}
              textAnchor="end"
              fill="var(--muted)"
              fontSize={10}
            >
              {Math.round(v).toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {hasBench && (
          <polyline
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={benchPts}
          />
        )}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={portPts}
        />
        {xLabels.map((d, i) => (
          <text
            key={i}
            x={i === 0 ? padL : i === 2 ? w - padR : padL + innerW / 2}
            y={h - 8}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fill="var(--muted)"
            fontSize={10}
          >
            {d}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3 rounded"
            style={{ background: "var(--accent)" }}
          />
          Portfolio
        </span>
        {hasBench && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3 rounded"
              style={{ background: "var(--muted)" }}
            />
            Benchmark
          </span>
        )}
      </div>
    </div>
  );
}
