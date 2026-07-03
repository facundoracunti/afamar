import React, { useState, useEffect } from 'react';
import { Search, Plus, PackagePlus, PackageMinus, Trash2 } from 'lucide-react';
import { getPoolStock, createPool, updatePool, deletePool, getPoolMovements, createPoolMovement } from '@/api/resources/poolStock';
import { useList, useDelete } from '../../api/hooks';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import type { Pool, PoolMovement } from '../../types/poolStock';
import styles from './PoolStockPage.module.css';

const s = styles as unknown as Record<string, string>;

const POOL_STOCK_KEY = ['pool-stock'] as const;

export default function PoolStockPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMov, setShowMov] = useState<Pool | null>(null);
  const [movimientos, setMovimientos] = useState<PoolMovement[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<Pool | null>(null);

  const [form, setForm] = useState<{ brand: string; model: string; description: string; material: string; quantity: number; price: number; priceUsd: number }>({ brand: '', model: '', description: '', material: '', quantity: 0, price: 0, priceUsd: 0 });
  const [movForm, setMovForm] = useState<{ type: string; quantity: number; description: string }>({ type: 'Ingreso', quantity: 1, description: '' });

  const { items: data, loading, load } = useList<Pool>(
    [...POOL_STOCK_KEY, search],
    async () => {
      const res = await getPoolStock({ search: search || undefined });
      return (res.data as Pool[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number>(
    POOL_STOCK_KEY,
    async (id) => { await deletePool(id); },
    { invalidateKeys: [POOL_STOCK_KEY] }
  );

  const handleOpenForm = (item: Pool | null = null) => {
    if (item) {
      setEditItem(item);
      setForm({ brand: item.brand, model: item.model, description: item.description || '', material: item.material || '', quantity: item.quantity, price: item.price || 0, priceUsd: item.priceUsd || 0 });
    } else {
      setEditItem(null);
      setForm({ brand: '', model: '', description: '', material: '', quantity: 0, price: 0, priceUsd: 0 });
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editItem) {
        await updatePool(editItem.id, form);
      } else {
        await createPool(form);
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      alert('Error al guardar');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleOpenMov = async (pileta: Pool) => {
    setShowMov(pileta);
    const res = await getPoolMovements(pileta.id);
    setMovimientos(res.data);
    setMovForm({ type: 'Ingreso', quantity: 1, description: '' });
  };

  const handleAddMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMov) return;
    try {
      await createPoolMovement(showMov.id, movForm);
      const res = await getPoolMovements(showMov.id);
      setMovimientos(res.data);
      load();
    setMovForm({ type: 'Ingreso', quantity: 1, description: '' });
    } catch (err: unknown) {
      alert('Error al registrar movimiento');
    }
  };

  return (
    <div className={s['poolStock']}>
      <div className={s['poolStock__header']}>
        <h1 className={s['poolStock__title']}>Stock de Piletas</h1>
        <button className="btn btn-primary" onClick={() => handleOpenForm()}>
          <Plus size={16} /> Nueva Pileta
        </button>
      </div>

      <div className={s['poolStock__card']} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <div className={s['poolStock__search'] || ''}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar por marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Material</th>
                  <th>Precio ARS</th>
                  <th>Precio USD</th>
                  <th>Cantidad</th>
                  <th style={{ width: 160 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.brand}</td>
                    <td>{p.model}</td>
                    <td>{p.material || '-'}</td>
                    <td style={{ fontWeight: 600 }}>${Number(p.price || 0).toLocaleString('es-AR')}</td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>USD {Number(p.priceUsd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span style={{
                        fontWeight: 700, fontSize: 16,
                        color: p.quantity > 0 ? '#16a34a' : '#dc2626',
                      }}>{p.quantity}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => handleOpenForm(p)}>Editar</button>
                        <button className="btn btn-success" style={{ padding: '4px 8px' }} onClick={() => handleOpenMov(p)} title="Movimientos">
                          <PackagePlus size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setDeleteId(p.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay piletas en stock</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulario Pileta */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Editar Pileta' : 'Nueva Pileta'} width="500px">
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label>Marca *</label>
              <select className="input" required value={['JOHNSON', 'MI PILETA'].includes(form.brand) ? form.brand : 'OTHER'} onChange={(e) => setForm({ ...form, brand: e.target.value === 'OTHER' ? '' : e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="JOHNSON">JOHNSON</option>
                <option value="MI PILETA">MI PILETA</option>
                <option value="OTHER">OTRA (escribir)</option>
              </select>
              {!['JOHNSON', 'MI PILETA', ''].includes(form.brand) && (
                <input className="input" style={{ marginTop: 6 }} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Escribí la marca..." />
              )}
            </div>
            <div className="form-group"><label>Modelo *</label><input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Material</label><input className="input" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></div>
            <div className="form-group"><label>Precio ARS ($)</label><input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Precio USD</label><input className="input" type="number" step="0.01" min="0" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Cantidad</label><input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label>Descripción</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Movimientos */}
      <Modal isOpen={!!showMov} onClose={() => setShowMov(null)} title={`Movimientos - ${showMov?.brand} ${showMov?.model}`} width="600px">
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Registrar Movimiento</h4>
          <form onSubmit={handleAddMov} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 140 }} value={movForm.type} onChange={(e) => setMovForm({ ...movForm, type: e.target.value })}>
              <option value="Ingreso">Ingreso</option>
              <option value="Egreso">Egreso</option>
            </select>
            <input className="input" style={{ width: 100 }} type="number" min="1" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })} />
            <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Descripción" value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} />
            <button type="submit" className="btn btn-primary">
              {movForm.type === 'Ingreso' ? <PackagePlus size={14} /> : <PackageMinus size={14} />} Registrar
            </button>
          </form>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Historial</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tipo</th><th>Cantidad</th><th>Descripción</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td><span className={`badge ${m.type === 'Ingreso' ? 'badge-approved' : 'badge-rejected'}`}>{m.type}</span></td>
                  <td style={{ fontWeight: 600 }}>{m.quantity}</td>
                  <td>{m.description || '-'}</td>
                  <td>{new Date(m.created_at || '').toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin movimientos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar pileta" message="¿Estás seguro?" />
    </div>
  );
}
