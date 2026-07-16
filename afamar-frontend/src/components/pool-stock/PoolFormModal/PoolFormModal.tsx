import React from 'react';
import { Modal } from '../../ui/Modal/Modal';
import type { Pool, PoolType } from '../../../types/poolStock';
import styles from '../../../pages/pool-stock/PoolStockPage.module.css';

const s = styles as unknown as Record<string, string>;

interface PoolFormModalProps {
  isOpen: boolean;
  editItem: Pool | null;
  poolTypes: PoolType[];
  onSave: (form: PoolFormState) => Promise<void>;
  onClose: () => void;
}

export interface PoolFormState {
  brand: string;
  model: string;
  description: string;
  material: string;
  quantity: number;
  price: number;
  currency: string;
  pool_type_id: number | string;
}

const INITIAL_FORM: PoolFormState = {
  brand: '',
  model: '',
  description: '',
  material: '',
  quantity: 0,
  price: 0,
  currency: 'ARS',
  pool_type_id: 1,
};

export function PoolFormModal({ isOpen, editItem, poolTypes, onSave, onClose }: PoolFormModalProps) {
  const [form, setForm] = React.useState<PoolFormState>(INITIAL_FORM);

  React.useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setForm({
          brand: editItem.brand,
          model: editItem.model,
          description: editItem.description || '',
          material: editItem.material || '',
          quantity: editItem.quantity,
          price: editItem.price || 0,
          currency: editItem.currency || 'ARS',
          pool_type_id: editItem.pool_type_id ?? 1,
        });
      } else {
        setForm(INITIAL_FORM);
      }
    }
  }, [isOpen, editItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Editar Pileta' : 'Nueva Pileta'}
      width="500px"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Marca *</label>
            <select
              className="input"
              required
              value={['JOHNSON', 'MI PILETA'].includes(form.brand) ? form.brand : 'OTHER'}
              onChange={(e) => setForm({ ...form, brand: e.target.value === 'OTHER' ? '' : e.target.value })}
            >
              <option value="">Seleccionar...</option>
              <option value="JOHNSON">JOHNSON</option>
              <option value="MI PILETA">MI PILETA</option>
              <option value="OTHER">OTRA (escribir)</option>
            </select>
            {!['JOHNSON', 'MI PILETA', ''].includes(form.brand) && (
              <input
                className={`input ${s['poolStock__brand-input']}`}
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Escribí la marca..."
              />
            )}
          </div>
          <div className="form-group">
            <label>Modelo *</label>
            <input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Tipo</label>
            <select
              className="input"
              value={form.pool_type_id}
              onChange={(e) => setForm({ ...form, pool_type_id: Number(e.target.value) })}
            >
              {poolTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Material</label>
            <input className="input" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Moneda</label>
            <select
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="ARS">ARS ($)</option>
              <option value="USD">USD (US$)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Precio ({form.currency === 'USD' ? 'USD' : 'ARS'})</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Cantidad</label>
            <input
              className="input"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <div className={s['poolStock__form-footer']}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
