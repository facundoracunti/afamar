import React from 'react';

interface ObservacionesSectionProps {
  form: {
    observaciones_importantes: string;
  };
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function ObservacionesSection({ form, readOnly, update }: ObservacionesSectionProps) {
  return (
    <div className="card" style={{ marginTop: 16, background: '#f9fafb', border: '1px solid #b91c1c' }}>
      <h3 className="section-title" style={{ color: '#b91c1c' }}>OBSERVACIONES IMPORTANTES PARA EL CLIENTE</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#374151', marginBottom: 12 }}>
        <div>✓ No se realizan instalaciones.</div>
        <div>✓ No se realizan entregas con lluvia.</div>
        <div>✓ La descarga se realiza al pie del camión.</div>
        <div>✓ Debe haber personas para descargar.</div>
        <div>✓ El traslado lo realiza únicamente el fletero.</div>
      </div>
      <div className="form-group">
        <label style={{ fontWeight: 600 }}>Observaciones adicionales</label>
        <textarea className="input" rows={3} value={form.observaciones_importantes} onChange={(e) => update('observaciones_importantes', e.target.value)} placeholder="Agregar observaciones adicionales..." disabled={readOnly} />
      </div>
    </div>
  );
}
