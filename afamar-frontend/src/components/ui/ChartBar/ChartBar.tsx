import styles from "./ChartBar.module.css";

interface ChartBarItem {
  label: string;
  value: number;
  color: string;
}

interface ChartBarProps {
  items: ChartBarItem[];
  maxValue: number;
  horizontal?: boolean;
}

export function ChartBar({ items, maxValue, horizontal }: ChartBarProps) {
  if (horizontal) {
    return (
      <div className={styles.chartHorizontal}>
        {items.map((item) => (
          <div key={item.label} className={styles.chartHorizontal__item}>
            <span className={styles.chartHorizontal__label}>{item.label}</span>
            <div className={styles.chartHorizontal__track}>
              <div
                className={styles.chartHorizontal__fill}
                style={{ width: `${(item.value / maxValue) * 100}%`, background: item.color }}
              />
            </div>
            <span className={styles.chartHorizontal__value}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.chartVertical}>
      {items.map((item) => (
        <div key={item.label} className={styles.chartVertical__item}>
          <span className={styles.chartVertical__label}>{item.label}</span>
          <div className={styles.chartVertical__track}>
            <div
              className={styles.chartVertical__fill}
              style={{ height: `${(item.value / maxValue) * 100}%`, background: item.color }}
            />
          </div>
          <span className={styles.chartVertical__value}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
