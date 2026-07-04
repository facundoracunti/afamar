import React, { useMemo, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { createClient } from '@/api/resources/clients';
import { useNotify } from '../../../context/NotificationContext';
import type { EntityFormState } from '../../../types/form';
import type { Client } from '../../../types/client';

interface ClientSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  /**
   * Called after the backend creates a new client.
   * Receives the freshly created client so the parent's local list can be
   * updated without re-fetching (which would re-render the form shell).
   */
  onClientCreated: (newClient: Client) => void;
}

export default function ClientSection({
  form, readOnly, update, clientes, onClientCreated,
}: ClientSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '' });
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const notify = useNotify();

  /**
   * Match strategy:
   *  - When the input is focused or has text, filter by substring (case-insensitive)
   *    against name / phone / address.
   *  - When the input is empty, show up to 30 of the most recent clients so the
   *    field is still useful without typing.
   */
  const filteredClientes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return clientes.slice(0, 30);
    }
    return clientes.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || address.includes(q);
    });
  }, [clientes, query]);

  const selectedClient = clientes.find((c) => c.name === form.client_name);

  const handleSelect = (c: Client) => {
    update('client_name', c.name);
    update('client_phone', c.phone || '');
    update('client_email', c.email || '');
    update('client_address', c.address || '');
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    update('client_name', '');
    update('client_phone', '');
    update('client_email', '');
    update('client_address', '');
    setQuery('');
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      const res = await createClient(newClient);
      const created = (res.data as Client);
      // Patch the form so the rest of the page sees the new client right away.
      update('client_name', created.name);
      update('client_phone', created.phone || '');
      update('client_email', created.email || '');
      update('client_address', created.address || '');
      // Hand the new client up so the dropdown updates without a full refetch.
      onClientCreated(created);
      setShowModal(false);
      setNewClient({ name: '', phone: '', email: '', address: '' });
      setQuery('');
      notify('Cliente creado correctamente', 'success');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify(detail || 'Error al crear cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Open the modal pre-filled with the current search query so the user can
   * hit "+ Nuevo" straight from the typeahead when no matches are found.
   */
  const openNewFromQuery = () => {
    setNewClient((prev) => ({ ...prev, name: query.trim() }));
    setShowModal(true);
    setOpen(false);
  };

  const displayValue = query !== '' ? query : (selectedClient?.name || '');
  const showClear = !readOnly && (!!selectedClient || query !== '');

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="orden-grid-4">
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" className="input" value={form.date || ''} onChange={(e) => update('date', e.target.value)} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Cliente</label>
            <div
              ref={wrapperRef}
              style={{ position: 'relative', display: 'flex', gap: 6 }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className="input"
                  placeholder={selectedClient ? '' : 'Buscar cliente por nombre, teléfono o dirección...'}
                  value={displayValue}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    // If the user starts typing and the previously selected client
                    // doesn't match anymore, keep the client_name in form so the
                    // rest of the section stays put until they pick something else.
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  disabled={readOnly}
                  style={{ paddingRight: showClear ? 28 : undefined }}
                />
                {showClear && (
                  <button
                    type="button"
                    aria-label="Limpiar cliente"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClear}
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
                          onClick={openNewFromQuery}
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
                            onClick={() => handleSelect(c)}
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
                            onClick={openNewFromQuery}
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
                  onClick={() => setShowModal(true)}
                  title="Crear nuevo cliente"
                  style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Nuevo
                </button>
              )}
            </div>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Cliente">
        <form onSubmit={handleCreateClient}>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              className="input"
              required
              autoFocus
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="input" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input className="input" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !newClient.name.trim()}>
              {saving ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
