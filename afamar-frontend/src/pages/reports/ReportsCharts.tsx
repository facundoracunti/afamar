/**
 * Charts for the Reports page.
 *
 * Split into its own module so `recharts` (≈ 90 KB min / ≈ 30 KB gzip)
 * is only fetched when the user opens the "Ventas Mensuales" or
 * "Materiales Más Utilizados" tabs. The parent `ReportsPage` loads
 * this module via `React.lazy()` and renders it inside `<Suspense>`.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface SalesChartProps {
  data: Array<Record<string, unknown>>;
  year: number;
}

export function MonthlySalesChart({ data, year }: SalesChartProps) {
  return (
    <div>
      <h3 className="section-title">Ventas Mensuales - {year}</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mes" tickFormatter={(m) => MONTH_LABELS[(m as number) - 1]} />
          <YAxis />
          <Tooltip formatter={(v: number) => `$${v?.toFixed(2)}`} />
          <Bar dataKey="monto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MaterialsChartProps {
  materials: Array<Record<string, unknown>>;
  materialNameClass: string;
  emptyMessage: string;
}

export function MostUsedMaterialsChart({ materials, materialNameClass, emptyMessage }: MaterialsChartProps) {
  return (
    <div>
      <h3 className="section-title">Materiales Más Utilizados</h3>
      {materials.length > 0 ? (
        <div className="grid-2">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={materials}
                dataKey="total"
                nameKey="material"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ material, total }: { material: string; total: number }) => `${material}: ${total}`}
              >
                {materials.map((m, i) => <Cell key={(m as Record<string, unknown>).material as string ?? `cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div>
            <table>
              <thead>
                <tr><th>Material</th><th>Veces utilizado</th></tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={(m as Record<string, unknown>).material as string}>
                    <td className={materialNameClass}>{m.material as string}</td>
                    <td>{m.total as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>{emptyMessage}</p>
      )}
    </div>
  );
}
