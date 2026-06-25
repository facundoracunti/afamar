import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { getMaterial, createMaterial, updateMaterial, getConfig } from '../../services/api';
import { categoriasMaterial } from '../../utils/formatters';
import type { MaterialFormData } from '../../types/material';
import type { Configuracion } from '../../types/configuracion';
import Loading from '../../components/common/Loading';

export default function MaterialForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [tipoCambio, setTipoCambio] = useState(1);
  const [form, setForm] = useState<MaterialFormData>({
    nombre: '', categoria: '', color: '', espesor_disponible: '',
    precio_m2: 0, precio_m2_usd: 0, moneda: 'ARS', proveedor: '', stock_disponible: 0, observaciones: '',
  });

  useEffect(() => {
    getConfig().then((res) => {
      const map: Record<string, string> = {};
      (res.data as Configuracion[]).forEach((c) => { map[c.key] = c.value; });
      setTipoCambio(Number(map.tipo_cambio) || 1);
    });
    if (id) {
      getMaterial(id).then((res) => {
        const d = res.data;
        setForm({
          nombre: d.nombre || '', categoria: d.categoria || '', color: d.color || '',
          espesor_disponible: d.espesor_disponible || '',
          precio_m2: d.precio_m2 || 0, precio_m2_usd: d.precio_m2_usd || 0,
          moneda: d.moneda || 'ARS',
          proveedor: d.proveedor || '',
          stock_disponible: d.stock_disponible || 0, observaciones: d.observaciones || '',
        });
        setLoading(false);
      });
    }
  }, [id]);

  const handlePrecioArsChange = (value: number) => {
    const ars = Number(value) || 0;
    const usd = form.moneda === 'ARS' ? (tipoCambio > 0 ? ars / tipoCambio : 0) : form.precio_m2_usd;
    setForm({ ...form, precio_m2: ars, precio_m2_usd: form.moneda === 'ARS' ? usd : form.precio_m2_usd });
  };

  const handlePrecioUsdChange = (value: number) => {
    const usd = Number(value) || 0;
    const ars = form.moneda === 'USD' ? (tipoCambio > 0 ? usd * tipoCambio : 0) : form.precio_m2;
    setForm({ ...form, precio_m2_usd: usd, precio_m2: form.moneda === 'USD' ? ars : form.precio_m2 });
  };

  const handleMonedaChange = (moneda: string) => {
    const m = moneda as 'ARS' | 'USD';
    if (m === 'ARS') {
      const usd = tipoCambio > 0 ? form.precio_m2 / tipoCambio : 0;
      setForm({ ...form, moneda: m, precio_m2_usd: usd });
    } else {
      const ars = tipoCambio > 0 ? form.precio_m2_usd * tipoCambio : 0;
      setForm({ ...form, moneda: m, precio_m2: ars });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateMaterial(id as string, form as unknown as Record<string, unknown>);
      } else {
        await createMaterial(form as unknown as Record<string, unknown>);
      }
      navigate('/admin/materiales');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{isEdit ? 'Editar Material' : 'Nuevo Material'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ maxWidth: 700 }}>
          <div className="form-row">
            <div className="form-group"><label>Nombre *</label><input className="input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="form-group"><label>Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Seleccionar...</option>
                {categoriasMaterial.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Color</label><input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
            <div className="form-group"><label>Espesor disponible</label><input className="input" value={form.espesor_disponible} onChange={(e) => setForm({ ...form, espesor_disponible: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Precio M²</label>
              <input className="input" type="number" step="0.01" min="0"
                value={form.moneda === 'USD' ? (form.precio_m2_usd || '') : (form.precio_m2 || '')}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (form.moneda === 'USD') handlePrecioUsdChange(v);
                  else handlePrecioArsChange(v);
                }} />
            </div>
            <div className="form-group" style={{ width: 130 }}>
              <label>Moneda</label>
              <select className="input" value={form.moneda} onChange={(e) => handleMonedaChange(e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Proveedor</label><input className="input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} /></div>
            <div className="form-group"><label>Stock disponible</label><input className="input" type="number" min="0" value={form.stock_disponible} onChange={(e) => setForm({ ...form, stock_disponible: Number(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label>Observaciones</label><textarea className="input" rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/materiales')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Material')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}