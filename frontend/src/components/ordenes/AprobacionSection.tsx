import React from 'react';
import FirmaCanvas from '../firma/FirmaCanvas';

interface AprobacionSectionProps {
  form: {
    firma_cliente: string | null;
    fecha_aprobacion: string;
  };
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function AprobacionSection({ form, readOnly, update }: AprobacionSectionProps) {
  return (
    <div className="card">
      <h3 className="section-title">APROBACIÓN DEL CLIENTE</h3>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        El cliente aprueba el diseño y presupuesto.
      </p>
      <FirmaCanvas
        value={form.firma_cliente}
        onChange={(v: unknown) => update('firma_cliente', v)}
        label="Firma del cliente"
        height={140}
        readOnly={readOnly}
      />
      <div className="form-group" style={{ marginTop: 8 }}>
        <label>Fecha de aprobación</label>
        <input type="date" className="input" value={form.fecha_aprobacion || ''} onChange={(e) => update('fecha_aprobacion', e.target.value)} disabled={readOnly} />
      </div>
    </div>
  );
}
