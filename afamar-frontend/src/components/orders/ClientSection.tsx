import React from 'react';

import type { EntityFormState } from '../../types/form';

interface ClientSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientRef: React.RefObject<HTMLDivElement | null>;
  showClientDropdown: boolean;
  setShowClientDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  filteredClients: unknown[];
  handleClientSelect: (c: Record<string, unknown>) => void;
}

export default function ClientSection({
  form, readOnly, update,
  clientRef, showClientDropdown, setShowClientDropdown,
  filteredClients, handleClientSelect,
}: ClientSectionProps) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="orden-grid-4">
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" className="input" value={form.date || ''} onChange={(e) => update('date', e.target.value)} disabled={readOnly} />
        </div>
        <div className="form-group" style={{ position: 'relative' }} ref={clientRef}>
          <label>Cliente</label>
          <input className="input" value={form.client_name} onChange={(e) => { update('client_name', e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} placeholder="Nombre del cliente" disabled={readOnly} />
          {showClientDropdown && filteredClients.length > 0 && form.client_name && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {filteredClients.map((c: Record<string, unknown>) => (
                <div key={c.id as number} onClick={() => handleClientSelect(c)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontWeight: 600 }}>{c.name as string}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.phone as string} {c.email ? `| ${c.email}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Teléfono</label>
          <input className="input" value={form.client_phone} onChange={(e) => update('client_phone', e.target.value)} placeholder="Teléfono" disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>E-mail</label>
          <input className="input" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} placeholder="Email" disabled={readOnly} />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label>Domicilio</label>
        <input className="input" value={form.client_address} onChange={(e) => update('client_address', e.target.value)} placeholder="Calle N° - Ciudad - Provincia" disabled={readOnly} />
      </div>
    </div>
  );
}
