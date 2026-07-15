import React, { useMemo, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import { createClient } from '@/api/resources/clients';
import { createClientAddress } from '@/api/resources/clientAddresses';
import { useNotify } from '../../../context/NotificationContext';
import type { EntityFormState } from '../../../types/form';
import type { Client, ClientAddress } from '../../../types/client';
import styles from './ClientSection.module.css';

const s = styles as unknown as Record<string, string>;

interface ClientSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: (newClient: Client) => void;
  onAddressAdded?: (clientId: number, address: ClientAddress) => void;
}

export default function ClientSection({
  form, readOnly, update, clientes, onClientCreated, onAddressAdded,
}: ClientSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '' });
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [addrQuery, setAddrQuery] = useState('');
  const [addrOpen, setAddrOpen] = useState(false);
  const [newAddrText, setNewAddrText] = useState('');
  const [addingAddr, setAddingAddr] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const addrWrapperRef = useRef<HTMLDivElement | null>(null);
  const notify = useNotify();

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

  const selectedClient = clientes.find((c) => c.name === form.client_name);

  const addresses: ClientAddress[] = selectedClient?.addresses || [];
  const hasMultipleAddresses = addresses.length > 1;

  const selectedAddress = form.delivery_address_id
    ? addresses.find((a) => a.id === form.delivery_address_id)
    : null;

  const filteredAddresses = useMemo(() => {
    const q = addrQuery.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) => {
      const addr = (a.address || '').toLowerCase();
      const label = (a.label || '').toLowerCase();
      return addr.includes(q) || label.includes(q);
    });
  }, [addresses, addrQuery]);

  const handleSelect = (c: Client) => {
    update('client_name', c.name);
    update('client_phone', c.phone || '');
    update('client_email', c.email || '');
    update('client_address', c.address || '');
    update('delivery_address_id', null);
    setQuery('');
    setOpen(false);
    setAddrQuery('');
    setAddrOpen(false);
  };

  const handleClear = () => {
    update('client_name', '');
    update('client_phone', '');
    update('client_email', '');
    update('client_address', '');
    update('delivery_address_id', null);
    setQuery('');
    setAddrQuery('');
    setAddrOpen(false);
  };

  const handleAddressSelect = (addr: ClientAddress) => {
    update('delivery_address_id', addr.id);
    update('client_address', addr.address);
    setAddrQuery('');
    setAddrOpen(false);
  };

  const handleAddressClear = () => {
    update('delivery_address_id', null);
    if (selectedClient) {
      update('client_address', selectedClient.address || '');
    }
    setAddrQuery('');
  };

  const handleAddAddress = async () => {
    if (!selectedClient || !newAddrText.trim()) return;
    setAddingAddr(true);
    try {
      const created = await createClientAddress(selectedClient.id, { address: newAddrText.trim() });
      onAddressAdded?.(selectedClient.id, created);
      update('delivery_address_id', created.id);
      update('client_address', created.address);
      setNewAddrText('');
      setAddrQuery('');
      notify('Dirección agregada', 'success');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify(detail || 'Error al agregar dirección', 'error');
    } finally {
      setAddingAddr(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      const res = await createClient(newClient);
      const created = (res.data as Client);
      update('client_name', created.name);
      update('client_phone', created.phone || '');
      update('client_email', created.email || '');
      update('client_address', created.address || '');
      update('delivery_address_id', null);
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
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setOpen(false);
                      const typed = query.trim();
                      if (!typed || typed === form.client_name) return;
                      const match = clientes.find(
                        (c) => (c.name || '').trim().toLowerCase() === typed.toLowerCase(),
                      );
                      if (match) {
                        update('client_name', match.name);
                        update('client_phone', match.phone || '');
                        update('client_email', match.email || '');
                        update('client_address', match.address || '');
                        update('delivery_address_id', null);
                      } else {
                        update('client_name', typed);
                      }
                    }, 150);
                  }}
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
            <input className="input" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} placeholder="Correo" disabled={readOnly} />
          </div>
        </div>

        {hasMultipleAddresses && selectedClient && !readOnly && (
          <div className={s['client-section__addr-row']}>
            <div className={s['client-section__addr-label']}>Dirección de obra:</div>
            <div ref={addrWrapperRef} className={s['client-section__addr-picker']}>
              <button
                type="button"
                className={s['client-section__addr-trigger']}
                onClick={() => setAddrOpen((v) => !v)}
              >
                <span className={s['client-section__addr-trigger-text']}>
                  {selectedAddress
                    ? `${selectedAddress.label ? selectedAddress.label + ' — ' : ''}${selectedAddress.address}`
                    : 'Usar dirección principal'
                  }
                </span>
                <ChevronDown size={14} />
              </button>
              {selectedAddress && (
                <button
                  type="button"
                  className={s['client-section__addr-clear']}
                  onClick={handleAddressClear}
                  title="Volver a dirección principal"
                >
                  ✕
                </button>
              )}
              {addrOpen && (
                <div className={s['client-section__addr-dropdown']}>
                  <input
                    className={s['client-section__addr-search']}
                    placeholder="Buscar dirección..."
                    value={addrQuery}
                    onChange={(e) => setAddrQuery(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAddrOpen(false);
                        setAddrQuery('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={`${s['client-section__addr-option']} ${!form.delivery_address_id ? s['client-section__addr-option--active'] : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { handleAddressClear(); setAddrOpen(false); }}
                  >
                    <span className={s['client-section__addr-option-label']}>Principal</span>
                    <span className={s['client-section__addr-option-addr']}>{selectedClient.address || '—'}</span>
                  </button>
                  {filteredAddresses.filter((a) => !a.is_default).map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      className={`${s['client-section__addr-option']} ${form.delivery_address_id === addr.id ? s['client-section__addr-option--active'] : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddressSelect(addr)}
                    >
                      <span className={s['client-section__addr-option-label']}>
                        {addr.label || `Alternativa ${addr.id}`}
                      </span>
                      <span className={s['client-section__addr-option-addr']}>{addr.address}</span>
                    </button>
                  ))}
                  {filteredAddresses.filter((a) => !a.is_default).length === 0 && addrQuery.trim() && (
                    <div className={s['client-section__addr-empty']}>
                      Sin resultados para "{addrQuery.trim()}"
                    </div>
                  )}
                  <div className={s['client-section__addr-new']}>
                    <input
                      className={s['client-section__addr-new-input']}
                      placeholder="Nueva dirección..."
                      value={newAddrText}
                      onChange={(e) => setNewAddrText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAddress(); } }}
                      disabled={addingAddr}
                    />
                    <button
                      type="button"
                      className={s['client-section__addr-new-btn']}
                      onClick={handleAddAddress}
                      disabled={addingAddr || !newAddrText.trim()}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 8 }}>
          <label>Domicilio</label>
          <input
            className="input"
            value={form.client_address}
            onChange={(e) => {
              update('client_address', e.target.value);
              if (form.delivery_address_id) {
                update('delivery_address_id', null);
              }
            }}
            placeholder="Calle N° - Ciudad - Provincia"
            disabled={readOnly}
          />
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
              <label>Correo</label>
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
