import React from 'react';
import type { EntityFormState } from '../../types';

interface WorkOrderFormSnapshotProps {
  form: EntityFormState;
  readOnly: boolean;
}

export default function WorkOrderFormSnapshot({
  form,
  readOnly,
}: WorkOrderFormSnapshotProps) {
  if (!form.snapshot || Object.keys(form.snapshot).length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="section-title">DATOS DEL SNAPSHOT (PRESUPUESTO ORIGEN)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Cliente</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.cliente_nombre ?? '—')}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Presupuesto</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.presupuesto_numero ?? '—')}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Material</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.material_nombre ?? '—')}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Color</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.material_color ?? '—')}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Espesor</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.material_espesor ?? '—')} cm</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Frente</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.frente ?? '—')} cm</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Acabado</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{String(form.snapshot.acabado ?? '—')}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Precio m²</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{form.snapshot.precio_m2 ? `$${Number(form.snapshot.precio_m2).toLocaleString('es-AR')}` : '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Total Presupuesto</div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{form.snapshot.total_presupuesto ? `$${Number(form.snapshot.total_presupuesto).toLocaleString('es-AR')}` : '—'}</div>
        </div>
      </div>
    </div>
  );
}