import React, { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Client } from '../../../types/client';
import styles from './ClientSection.module.css';

const s = styles as unknown as Record<string, string>;

interface ClientTypeaheadProps {
  value: string;
  query: string;
  open: boolean;
  clientes: Client[];
  readOnly: boolean;
  onQueryChange: (q: string) => void;
  onOpen: (v: boolean) => void;
  onSelect: (c: Client) => void;
  onClear: () => void;
  onCreateNew: (name: string) => void;
}

export function ClientTypeahead({
  value,
  query,
  open,
  clientes,
  readOnly,
  onQueryChange,
  onOpen,
  onSelect,
  onClear,
  onCreateNew,
}: ClientTypeaheadProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const showClear = !readOnly && (!!value || query !== '');

  const filteredClientes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes.slice(0, 30);
    return clientes.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || address.includes(q);
    });
  }, [clientes, query]);

  const displayValue = query !== '' ? query : value;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', gap: 6 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          className="input"
          placeholder={value ? '' : 'Buscar cliente por nombre, teléfono o dirección...'}
          value={displayValue}
          onChange={(e) => {
            onQueryChange(e.target.value);
            onOpen(true);
          }}
          onFocus={() => onOpen(true)}
          onBlur={() => {
            setTimeout(() => onOpen(false), 150);
          }}
          disabled={readOnly}
          style={{ paddingRight: showClear ? 28 : undefined }}
        />
        {showClear && (
          <button
            type="button"
            aria-label="Limpiar cliente"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClear}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
        {open && !readOnly && (
          <div
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10,
              marginTop: 4,
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {filteredClientes.length === 0 ? (
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Sin resultados para "{query.trim()}"
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onCreateNew(query.trim())}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <Plus size={14} /> Crear cliente "{query.trim()}"
                </button>
              </div>
            ) : (
              <>
                {filteredClientes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-alt-bg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {(c.phone || c.email || c.address) && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[c.phone, c.email, c.address].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </button>
                ))}
                {query.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onCreateNew(query.trim())}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: 'var(--surface-alt-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      borderTop: '1px solid var(--border-color)',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={14} /> Crear cliente "{query.trim()}"
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onCreateNew('')}
          title="Crear nuevo cliente"
          style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
        >
          <Plus size={14} /> Nuevo
        </button>
      )}
    </div>
  );
}
