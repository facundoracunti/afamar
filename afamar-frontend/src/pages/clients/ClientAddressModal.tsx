/**
 * Modal de alta / edición de un domicilio del cliente.
 *
 * Extracted verbatim from `ClientFormPage.tsx`: same fields, same placeholders,
 * same buttons and same disabled rules.
 */
import React from 'react';
import { Modal } from '../../components/ui/Modal/Modal';

/** Values of the address form. */
export interface ClientAddressFormValues {
  address: string;
  label: string;
  is_default: boolean;
}

interface ClientAddressModalProps {
  open: boolean;
  editing: boolean;
  form: ClientAddressFormValues;
  saving: boolean;
  onChange: (form: ClientAddressFormValues) => void;
  onSave: () => void;
  onClose: () => void;
}

export function ClientAddressModal({
  open,
  editing,
  form,
  saving,
  onChange,
  onSave,
  onClose,
}: ClientAddressModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editing ? 'Editar domicilio' : 'Nuevo domicilio'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <div className="form-group">
          <label>Etiqueta (ej. Casa, Oficina, Cliente 1)</label>
          <input
            className="input"
            value={form.label}
            onChange={(e) => onChange({ ...form, label: e.target.value })}
            placeholder="Principal"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Dirección *</label>
          <input
            className="input"
            required
            value={form.address}
            onChange={(e) => onChange({ ...form, address: e.target.value })}
            placeholder="Calle N° - Ciudad - Provincia"
          />
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="address-default"
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => onChange({ ...form, is_default: e.target.checked })}
          />
          <label htmlFor="address-default" style={{ marginBottom: 0 }}>
            Marcar como domicilio principal
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !form.address.trim()}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
