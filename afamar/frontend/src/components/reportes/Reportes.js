import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getReportePresupuestos, getReporteOrdenes, getVentasMensuales, getMaterialesMasUsados } from '../../services/api';
import Loading from '../common/Loading';

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('presupuestos');
  const [presupuestos, setPresupuestos] = useState(null);
  const [ordenes, setOrdenes] = useState(null);
  const [ventas, setVentas] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getReportePresupuestos(),
      getReporteOrdenes(),
      getVentasMensuales(),
      getMaterialesMasUsados(),
    ]).then(([p, o, v, m]) => {
      setPresupuestos(p.data);
      setOrdenes(o.data);
      setVentas(v.data);
      setMateriales(m.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  const tabs = [
    { key: 'presupuestos', label: 'Presupuestos' },
    { key: 'ordenes', label: 'Órdenes' },
    { key: 'ventas', label: 'Ventas Mensuales' },
    { key: 'materiales', label: 'Materiales' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Reportes</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'presupuestos' && presupuestos && (
          <div>
            <h3 className="section-title">Resumen de Presupuestos</h3>
            <div className="grid-4">
              <div className="stat-card">
                <div className="value" style={{ color: '#3b82f6' }}>{presupuestos.total}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#f59e0b' }}>{presupuestos.pendientes}</div>
                <div className="label">Pendientes</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#22c55e' }}>{presupuestos.aprobados}</div>
                <div className="label">Aprobados</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#ef4444' }}>{presupuestos.rechazados}</div>
                <div className="label">Rechazados</div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Monto total: ${presupuestos.monto_total?.toFixed(2)}</p>
            </div>
          </div>
        )}

        {activeTab === 'ordenes' && ordenes && (
          <div>
            <h3 className="section-title">Resumen de Órdenes</h3>
            <div className="grid-4">
              <div className="stat-card">
                <div className="value" style={{ color: '#3b82f6' }}>{ordenes.total}</div>
                <div className="label">Totales</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#f59e0b' }}>{ordenes.presupuestadas}</div>
                <div className="label">Presupuestadas</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#8b5cf6' }}>{ordenes.en_produccion}</div>
                <div className="label">En Producción</div>
              </div>
              <div className="stat-card">
                <div className="value" style={{ color: '#22c55e' }}>{ordenes.finalizadas}</div>
                <div className="label">Finalizadas</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ventas' && ventas && (
          <div>
            <h3 className="section-title">Ventas Mensuales - {ventas.año}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={ventas.ventas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tickFormatter={(m) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m-1]} />
                <YAxis />
                <Tooltip formatter={(v) => `$${v?.toFixed(2)}`} />
                <Bar dataKey="monto" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'materiales' && (
          <div>
            <h3 className="section-title">Materiales Más Utilizados</h3>
            {materiales.length > 0 ? (
              <div className="grid-2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={materiales} dataKey="total" nameKey="material" cx="50%" cy="50%" outerRadius={100} label={({ material, total }) => `${material}: ${total}`}>
                      {materiales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                      {materiales.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.material}</td>
                          <td>{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>No hay datos suficientes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
