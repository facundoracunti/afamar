import React from 'react';

interface Props {
  number: string;
  client: string;
  phone: string;
  workType: string;
  date: string;
  usdRate: number;
  onClientChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onWorkTypeChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onUsdRateChange: (v: number) => void;
}

export default function OnlineBudgetHeader({
  number, client, phone, workType, date, usdRate,
  onClientChange, onPhoneChange, onWorkTypeChange, onDateChange, onUsdRateChange,
}: Props) {
  return (
    <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 12 } as React.CSSProperties}>
        AFAMAR - MARMOLES & GRANITOS - LA PLATA, BS AS
        {number && <span style={{ marginLeft: 16, fontSize: 18, color: '#c0392b' } as React.CSSProperties}>PRESUPUESTO N {number}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' } as React.CSSProperties}>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>CLIENTE / EMPRESA</label>
          <input className="input" value={client} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onClientChange(e.target.value)} placeholder="Nombre del cliente" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>TELÉFONO (WhatsApp)</label>
          <input className="input" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)} placeholder="Ej: 2215551234" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 } as React.CSSProperties}>
          <label>TIPO DE OBRA</label>
          <input className="input" value={workType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onWorkTypeChange(e.target.value)} placeholder="Ej: Cocina, Bano" />
        </div>
        <div className="form-group" style={{ width: 140 } as React.CSSProperties}>
          <label>FECHA</label>
          <input type="date" className="input" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDateChange(e.target.value)} />
        </div>
        <div className="form-group" style={{ width: 160 } as React.CSSProperties}>
          <label style={{ fontWeight: 700, color: '#1e40af' } as React.CSSProperties}>DOLAR DEL DIA</label>
          <input type="number" step="1" className="input" style={{ fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd', textAlign: 'center', fontSize: 16 } as React.CSSProperties}
            value={usdRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; const nd = v === '' ? 0 : parseFloat(v) || 0; onUsdRateChange(nd); }} />
        </div>
      </div>
    </div>
  );
}
