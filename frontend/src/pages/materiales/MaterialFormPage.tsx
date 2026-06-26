import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Camera, Trash2 } from 'lucide-react';
import { getMaterial, createMaterial, updateMaterial, getConfig, uploadMaterialFoto } from '../../services/api';
import { categoriasMaterial } from '../../utils/formatters';
import type { MaterialFormData, Material } from '../../types/material';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingFoto, setExistingFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConfig().then((res) => {
      const map: Record<string, string> = {};
      (res.data as Configuracion[]).forEach((c) => { map[c.key] = c.value; });
      setTipoCambio(Number(map.tipo_cambio) || 1);
    });
    if (id) {
      getMaterial(id).then((res) => {
        const d = res.data as Material;
        setForm({
          nombre: d.nombre || '', categoria: d.categoria || '', color: d.color || '',
          espesor_disponible: d.espesor_disponible || '',
          precio_m2: d.precio_m2 || 0, precio_m2_usd: d.precio_m2_usd || 0,
          moneda: d.moneda || 'ARS',
          proveedor: d.proveedor || '',
          stock_disponible: d.stock_disponible || 0, observaciones: d.observaciones || '',
        });
        if (d.foto) setExistingFoto(d.foto);
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveFoto = () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(null);
    setFotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

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
      let materialId: string | number;
      if (isEdit) {
        await updateMaterial(id as string, form as unknown as Record<string, unknown>);
        materialId = id as string;
      } else {
        const res = await createMaterial(form as unknown as Record<string, unknown>);
        materialId = (res.data as Material).id;
      }
      if (selectedFile) {
        await uploadMaterialFoto(materialId, selectedFile);
      }
      navigate('/admin/materiales');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const displayUrl = fotoPreview || (existingFoto ? `/${existingFoto}` : null);

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

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 20 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Foto del Material</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFotoSelect}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {displayUrl ? (
                <div style={{ position: 'relative', width: 140, height: 140, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                  <img src={displayUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={handleRemoveFoto}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ width: 140, height: 140, borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f8fafc' }}>
                  <Camera size={32} color="#94a3b8" />
                </div>
              )}
              <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
                <Camera size={16} /> {existingFoto || fotoPreview ? 'Cambiar Foto' : 'Seleccionar Foto'}
              </button>
            </div>
            {selectedFile && <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{selectedFile.name}</p>}
          </div>

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