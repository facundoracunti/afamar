import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign, FileText, ClipboardList, PackageOpen, Globe, Truck } from 'lucide-react';
import { getDashboard } from '../../services/api';
import Loading from '../common/Loading';
import { formatCurrency } from '../../utils/formatters';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const cardStyle = {
    background: '#fff',
    borderRadius: 4,
    padding: '30px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#1a1a1a',
    fontWeight: 700,
    fontSize: '1.05rem',
    textTransform: 'uppercase',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #e1e4e8',
    minHeight: 120,
    transition: 'transform 0.2s, box-shadow 0.2s',
  };

  const wideCardStyle = {
    ...cardStyle,
    gridColumn: 'span 3',
    minHeight: 180,
    fontSize: '1.3rem',
    flexDirection: 'column',
    gap: 8,
  };

  const tallCardStyle = {
    ...cardStyle,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    fontSize: '1.3rem',
    padding: 20,
    lineHeight: 1.6,
  };

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100vh', margin: -24, padding: 0 }}>
      {/* Header rojo */}
      <header style={{
        background: '#e51a24',
        color: '#fff',
        padding: '25px 0',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginBottom: 30,
      }}>
        <h1 style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontSize: '3.5rem',
          fontWeight: 400,
          letterSpacing: '12px',
          margin: 0,
          marginLeft: 12,
        }}>afamar</h1>
      </header>

      {/* Grid */}
      <div style={{
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        padding: '0 20px 40px',
        display: 'grid',
        gridTemplateColumns: '3fr 1fr',
        gap: 20,
      }}>
        {/* Bloque izquierdo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {/* Fila 1 */}
          <div
            className="dash-card"
            style={{ ...cardStyle, borderLeft: '6px solid #007bff', justifyContent: 'flex-start', padding: '30px 24px' }}
            onClick={() => navigate('/ordenes')}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'none', fontWeight: 400 }}>CAJA</div>
              <div style={{ fontSize: '1.5rem', color: '#1e293b', textTransform: 'none' }}>
                {formatCurrency(data?.total_ingresos || 0)}
              </div>
            </div>
          </div>
          <div className="dash-card" style={cardStyle} onClick={() => navigate('/presupuestos/nuevo')}>
            <div>
              <div style={{ marginBottom: 8 }}><FileText size={28} color="#e51a24" /></div>
              NUEVO<br/>PRESUPUESTO
            </div>
          </div>
          <div className="dash-card" style={cardStyle} onClick={() => navigate('/ordenes/nuevo')}>
            <div>
              <div style={{ marginBottom: 8 }}><ClipboardList size={28} color="#e51a24" /></div>
              NUEVA<br/>ORDEN
            </div>
          </div>

          {/* Fila 2 - Ancha */}
          <div className="dash-card" style={wideCardStyle} onClick={() => navigate('/ordenes')}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>ÓRDENES ACTIVAS</div>
            <div style={{ display: 'flex', gap: 32, fontSize: '0.95rem', fontWeight: 600, color: '#64748b', textTransform: 'none' }}>
              <span>En Medición: <strong style={{ color: '#1e293b' }}>{data?.total_ordenes_activas || 0}</strong></span>
              <span>Total Órdenes: <strong style={{ color: '#1e293b' }}>{data?.total_ordenes || 0}</strong></span>
              <span>Entregadas este mes: <strong style={{ color: '#1e293b' }}>{data?.ordenes_entregadas_mes || 0}</strong></span>
            </div>
          </div>

          {/* Fila 3 */}
          <div className="dash-card" style={cardStyle} onClick={() => navigate('/ordenes?estado=ENTREGADA')}>
            <div>
              <div style={{ marginBottom: 8 }}><Truck size={28} color="#e51a24" /></div>
              ÓRDENES<br/>TERMINADAS P/ ENVÍO
            </div>
          </div>
          <div className="dash-card" style={cardStyle} onClick={() => navigate('/stock-piletas')}>
            <div>
              <div style={{ marginBottom: 8 }}><PackageOpen size={28} color="#e51a24" /></div>
              STOCK DE<br/>PILETAS
            </div>
          </div>
          <div className="dash-card" style={cardStyle} onClick={() => navigate('/materiales')}>
            <div>
              <div style={{ marginBottom: 8 }}><DollarSign size={28} color="#e51a24" /></div>
              CATÁLOGO DE<br/>COLORES
            </div>
          </div>
        </div>

        {/* Bloque derecho - PRESUPUESTOS EN LÍNEA */}
        <div className="dash-card" style={tallCardStyle} onClick={() => navigate('/presupuestos-online/nuevo')}>
          <Globe size={36} color="#e51a24" style={{ marginBottom: 16 }} />
          <span>PRESUPUESTOS</span>
          <span>EN LÍNEA</span>
        </div>
      </div>
    </div>
  );
}
