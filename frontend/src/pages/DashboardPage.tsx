import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign, FileText, ClipboardList, PackageOpen, Globe, Truck } from 'lucide-react';
import type { DashboardData } from '../types/dashboard';
import { getDashboard } from '../services/api';
import Loading from '../components/common/Loading';
import { formatCurrency } from '../utils/formatters';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard().then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return <div className="p-6">Error al cargar el dashboard</div>;

  const cards = [
    {
      icon: DollarSign, label: 'CAJA', value: `$${data.total_ingresos?.toLocaleString() || '0'}`,
      color: '#2563eb', path: '/caja/diaria',
      description: 'Total de ingresos registrados'
    },
    {
      icon: FileText, label: 'NUEVO PRESUPUESTO', value: '',
      color: '#059669', path: '/presupuestos/nuevo',
      description: 'Crear un nuevo presupuesto'
    },
    {
      icon: ClipboardList, label: 'NUEVA ORDEN', value: '',
      color: '#dc2626', path: '/ordenes/nuevo',
      description: 'Crear una nueva orden de trabajo'
    },
    {
      icon: PackageOpen, label: 'ÓRDENES EN MEDICIÓN / TALLER', value: `${data.total_ordenes_activas || 0}`,
      color: '#d97706', path: '/ordenes',
      description: `${data.ordenes_en_medicion || 0} en medición · ${data.ordenes_en_taller || 0} en taller`
    },
    {
      icon: Truck, label: 'ÓRDENES TERMINADAS P/ ENVÍO', value: `${data.ordenes_terminadas || 0}`,
      color: '#7c3aed', path: '/ordenes?estado=TERMINADA',
      description: 'Listas para retirar'
    },
    {
      icon: Globe, label: 'PRESUPUESTOS EN LÍNEA', value: `${data.presupuestos_online?.length || 0}`,
      color: '#0891b2', path: '/presupuestos-online',
      description: 'Pendientes de revisión'
    },
    {
      icon: PackageOpen, label: 'STOCK DE PILETAS', value: '',
      color: '#be185d', path: '/stock-piletas',
      description: 'Gestionar stock de piletas'
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ backgroundColor: '#e51a24', padding: '24px 32px', marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700,
          color: '#fff', margin: 0, letterSpacing: 1
        }}>afamar</h1>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20,
        padding: '0 32px 32px', maxWidth: 1400, margin: '0 auto'
      }}>
        {cards.map((card, i) => (
          <div
            key={i}
            onClick={() => card.path && navigate(card.path)}
            style={{
              backgroundColor: '#fff', borderRadius: 12, padding: 24, cursor: card.path ? 'pointer' : 'default',
              borderTop: `4px solid ${card.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', flexDirection: 'column',
              gap: 8, gridColumn: (
                card.label === 'ÓRDENES EN MEDICIÓN / TALLER' || card.label === 'ÓRDENES TERMINADAS P/ ENVÍO'
              ) ? 'span 2' : 'span 1',
              ...(card.label === 'PRESUPUESTOS EN LÍNEA' ? { gridRow: 'span 2' } : {})
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {React.createElement(card.icon, { size: 20, color: card.color })}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {card.label}
              </span>
            </div>
            {card.value && (
              <span style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{card.value}</span>
            )}
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{card.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
