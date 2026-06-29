import React from "react";

export function HealthSparkline({ currentScore }) {
  const current = Number.isFinite(Number(currentScore)) ? Number(currentScore) : 55;
  const scores = [82, 74, 63, current];

  return (
    <div className="health-sparkline" aria-label="Four sprint health score trend">
      <div className="sparkline-label">
        <span>4-sprint trend</span>
        <strong>{scores.join(" -> ")}</strong>
      </div>
      <svg viewBox="0 0 168 62" role="img" aria-hidden="true">
        <polyline points="8,12 58,22 108,36 158,48" />
        {[
          [8, 12],
          [58, 22],
          [108, 36],
          [158, 48]
        ].map(([x, y], index) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 3 ? 5 : 4} />
        ))}
      </svg>
      <div className="sparkline-sprints">
        <span>S-3</span>
        <span>S-2</span>
        <span>S-1</span>
        <span>Now</span>
      </div>
    </div>
  );
}
