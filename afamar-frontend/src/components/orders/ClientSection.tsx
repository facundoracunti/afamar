import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '@/api/resources/clients';
import { useNotify } from '../../context/NotificationContext';
import type { EntityFormState } from '../../types/form';
import type { Client } from '../../types/client';

interface ClientSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientes: Client[];
  onClientCreated: () => void;
}

export default function ClientSection({
  form, readOnly, update, clientes, onClientCreated,
}: ClientSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '' });
  const notify = useNotify();

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = clientes.find((c) => c.id === Number(e.target.value));
    if (selected) {
      update('client_name', selected.name);
      update('client_phone', selected.phone || '');
      update('client_email', selected.email || '');
      update('client_address', selected.address || '');
    }
  };

  const selectedId = clientes.find((c) => c.name === form.client_name)?.id || '';

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      const res = await createClient(newClient);
      const created = res.data as Client;
      update('client_name', created.name);
      update('client_phone', created.phone || '');
      update('client_email', created.email || '');
      update('client_address', created.address || '');
      setShowModal(false);
      setNewClient({ name: '', phone: '', email: '', address: '' });
      notify('Cliente creado correctamente', 'success');
      onClientCreated();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify(detail || 'Error al crear cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

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
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="input"
                value={selectedId}
                onChange={handleSelectChange}
                disabled={readOnly}
                style={{ flex: 1 }}
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nuevo Cliente</h2>
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
