import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { updateClient } from '@/api/resources/clients';
import { parseApiError } from '../../utils/error';
import { useNotify } from '../../context/NotificationContext';
import type { Client } from '../../types/client';
import { ClientContactFields, type ClientFormValues } from '../../pages/clients/ClientContactFields';
import styles from './EditClientModal.module.css';

const s = styles as unknown as Record<string, string>;

interface EditClientModalProps {
  isOpen: boolean;
  client: Client;
  onClose: () => void;
  onSaved: (client: Client) => void;
}

const valuesFromClient = (client: Client): ClientFormValues => ({
  name: client.name || '',
  phone: client.phone || '',
  email: client.email || '',
  address: client.address || '',
  notes: client.notes || '',
});

export default function EditClientModal({ isOpen, client, onClose, onSaved }: EditClientModalProps) {
  const [values, setValues] = useState<ClientFormValues>(() => valuesFromClient(client));
  const [saving, setSaving] = useState(false);
  const notify = useNotify();

  useEffect(() => {
    if (isOpen) setValues(valuesFromClient(client));
  }, [client, isOpen]);

  const handleChange = (field: keyof ClientFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving || !values.name.trim()) return;

    setSaving(true);
    try {
      const response = await updateClient(client.id, values);
      const saved = (response.data || {}) as Partial<Client>;
      onSaved({ ...client, ...saved, id: client.id });
      notify('Cliente actualizado correctamente', 'success');
      onClose();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al actualizar cliente'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title="Editar cliente"
      width="680px"
    >
      <form onSubmit={handleSubmit}>
        <ClientContactFields values={values} onChange={handleChange} />
        <div className={s['edit-client-modal__group']}>
          <label className={s['edit-client-modal__label']} htmlFor="edit-client-notes">
            Observaciones
          </label>
          <textarea
            id="edit-client-notes"
            className="input"
            rows={3}
            value={values.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
          />
        </div>
        <div className={s['edit-client-modal__actions']}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !values.name.trim()}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
