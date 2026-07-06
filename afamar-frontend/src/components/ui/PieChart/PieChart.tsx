import styles from "./PieChart.module.css";

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export function PieChart({ data }: { data: PieChartData[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className={styles.empty}>Sin datos</p>;

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  let currentAngle = -Math.PI / 2;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(currentAngle);
    const startY = cy + r * Math.sin(currentAngle);
    const endAngle = currentAngle + angle;
    const endX = cx + r * Math.cos(endAngle);
    const endY = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
    const midAngle = currentAngle + angle / 2;
    const labelX = cx + (r + 24) * Math.cos(midAngle);
    const labelY = cy + (r + 24) * Math.sin(midAngle);
    const pct = ((d.value / total) * 100).toFixed(0);
    currentAngle = endAngle;
    return { path, color: d.color, label: d.label, value: d.value, pct, labelX, labelY };
  });

  return (
    <div className={styles.wrapper}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2" />
        ))}
        {slices.map((s, i) => (
          <text
            key={`l${i}`}
            x={s.labelX}
            y={s.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill="#333"
          >
            {s.pct}%
          </text>
        ))}
      </svg>
      <div className={styles.legend}>
        {slices.map((s, i) => (
          <div key={i} className={styles.legendItem}>
            <span className={styles.dot} style={{ background: s.color }} />
            <span className={styles.label}>{s.label}</span>
            <span className={styles.value}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
