import React from 'react';

interface Props {
  numero: string;
  cliente: string;
  telefono: string;
  tipoObra: string;
  fecha: string;
  dolarDia: number;
  onClienteChange: (v: string) => void;
  onTelefonoChange: (v: string) => void;
  onTipoObraChange: (v: string) => void;
  onFechaChange: (v: string) => void;
  onDolarDiaChange: (v: number) => void;
}

export default function PresupuestoOnlineHeader({
  numero, cliente, telefono, tipoObra, fecha, dolarDia,
  onClienteChange, onTelefonoChange, onTipoObraChange, onFechaChange, onDolarDiaChange,
}: Props) {
  return (
    <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 12 } as React.CSSProperties}>
        AFAMAR - MARMOLES & GRANITOS - LA PLATA, BS AS
        {numero && <span style={{ marginLeft: 16, fontSize: 18, color: '#c0392b' } as React.CSSProperties}>PRESUPUESTO N {numero}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' } as React.CSSProperties}>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>CLIENTE / EMPRESA</label>
          <input className="input" value={cliente} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onClienteChange(e.target.value)} placeholder="Nombre del cliente" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>TELÉFONO (WhatsApp)</label>
          <input className="input" value={telefono} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTelefonoChange(e.target.value)} placeholder="Ej: 2215551234" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>TIPO DE OBRA</label>
          <input className="input" value={tipoObra} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTipoObraChange(e.target.value)} placeholder="Ej: Cocina, Bano" />
        </div>
        <div className="form-group" style={{ width: 140 } as React.CSSProperties}>
          <label>FECHA</label>
          <input type="date" className="input" value={fecha} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFechaChange(e.target.value)} />
        </div>
        <div className="form-group" style={{ width: 160 } as React.CSSProperties}>
          <label style={{ fontWeight: 700, color: '#1e40af' } as React.CSSProperties}>DOLAR DEL DIA</label>
          <input type="number" step="1" className="input" style={{ fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd', textAlign: 'center', fontSize: 16 } as React.CSSProperties}
            value={dolarDia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; const nd = v === '' ? 0 : parseFloat(v) || 0; onDolarDiaChange(nd); }} />
        </div>
      </div>
    </div>
  );
}
