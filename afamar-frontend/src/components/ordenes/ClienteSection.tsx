import React from 'react';

interface ClienteSectionProps {
  form: {
    fecha: string;
    cliente_nombre: string;
    cliente_telefono_orden: string;
    email: string;
    domicilio: string;
  };
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clienteRef: React.RefObject<HTMLDivElement | null>;
  showClienteDropdown: boolean;
  setShowClienteDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  clientesFiltrados: unknown[];
  handleClienteSelect: (c: Record<string, unknown>) => void;
}

export default function ClienteSection({
  form, readOnly, update,
  clienteRef, showClienteDropdown, setShowClienteDropdown,
  clientesFiltrados, handleClienteSelect,
}: ClienteSectionProps) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="orden-grid-4">
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" className="input" value={form.fecha || ''} onChange={(e) => update('fecha', e.target.value)} disabled={readOnly} />
        </div>
        <div className="form-group" style={{ position: 'relative' }} ref={clienteRef}>
          <label>Cliente</label>
          <input className="input" value={form.cliente_nombre} onChange={(e) => { update('cliente_nombre', e.target.value); setShowClienteDropdown(true); }} onFocus={() => setShowClienteDropdown(true)} placeholder="Nombre del cliente" disabled={readOnly} />
          {showClienteDropdown && clientesFiltrados.length > 0 && form.cliente_nombre && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {clientesFiltrados.map((c: Record<string, unknown>) => (
                <div key={c.id as number} onClick={() => handleClienteSelect(c)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontWeight: 600 }}>{c.nombre as string}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.telefono as string} {c.email ? `| ${c.email}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Teléfono</label>
          <input className="input" value={form.cliente_telefono_orden} onChange={(e) => update('cliente_telefono_orden', e.target.value)} placeholder="Teléfono" disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>E-mail</label>
          <input className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" disabled={readOnly} />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label>Domicilio</label>
        <input className="input" value={form.domicilio} onChange={(e) => update('domicilio', e.target.value)} placeholder="Calle N° - Ciudad - Provincia" disabled={readOnly} />
      </div>
    </div>
  );
}
