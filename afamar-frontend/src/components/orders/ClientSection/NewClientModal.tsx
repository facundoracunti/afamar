import React, { useState } from 'react';
import { Modal } from '../../ui/Modal/Modal';
import { createClient } from '@/api/resources/clients';
import { useNotify } from '../../../context/NotificationContext';
import type { Client } from '../../../types/client';

interface NewClientModalProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (client: Client) => void;
}

export function NewClientModal({ isOpen, initialName, onClose, onCreated }: NewClientModalProps) {
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '' });
  const notify = useNotify();

  React.useEffect(() => {
    if (isOpen && initialName) {
      setNewClient((prev) => ({ ...prev, name: initialName }));
    }
  }, [isOpen, initialName]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      const res = await createClient(newClient);
      const created = res.data as Client;
      onCreated(created);
      setNewClient({ name: '', phone: '', email: '', address: '' });
      onClose();
      notify('Cliente creado correctamente', 'success');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify(detail || 'Error al crear cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNewClient({ name: '', phone: '', email: '', address: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo Cliente">
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
          <button type="button" className="btn btn-outline" onClick={handleClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !newClient.name.trim()}>
            {saving ? 'Creando...' : 'Crear Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
