import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Camera, Trash2 } from 'lucide-react';
import { getMaterial, createMaterial, updateMaterial, uploadMaterialPhoto } from '@/api/resources/materials';
import { getSettings } from '@/api/resources/settings';
import { categoriasMaterial } from '../../utils/formatters';
import type { MaterialFormData, Material } from '../../types/material';
import Loading from '../../components/common/Loading';
import styles from './MaterialFormPage.module.css';

const s = styles as unknown as Record<string, string>;

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
    getSettings().then((res) => {
      const map: Record<string, string> = {};
      const data = (res as unknown as { data: Record<string, unknown> }).data || {};
      Object.entries(data).forEach(([k, v]) => { map[k] = String(v ?? ''); });
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
        await uploadMaterialPhoto(materialId, selectedFile);
      }
      navigate('/admin/materials');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const displayUrl = fotoPreview || (existingFoto ? `/${existingFoto}` : null);

  return (
    <div className={s['material-form']}>
      <h1 className={s['material-form__title']}>{isEdit ? 'Editar Material' : 'Nuevo Material'}</h1>

      <form onSubmit={handleSubmit}>
        <div className={s['material-form__card']}>
          <div className={s['material-form__row']}>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Nombre *</label>
              <input className="input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Seleccionar...</option>
                {categoriasMaterial.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className={s['material-form__row']}>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Color</label>
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Espesor disponible</label>
              <input className="input" value={form.espesor_disponible} onChange={(e) => setForm({ ...form, espesor_disponible: e.target.value })} />
            </div>
          </div>
          <div className={s['material-form__row']}>
            <div className={`${s['material-form__group']} ${s['material-form__group--grow']}`}>
              <label className={s['material-form__label']}>Precio M²</label>
              <input className="input" type="number" step="0.01" min="0"
                value={form.moneda === 'USD' ? (form.precio_m2_usd || '') : (form.precio_m2 || '')}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (form.moneda === 'USD') handlePrecioUsdChange(v);
                  else handlePrecioArsChange(v);
                }} />
            </div>
            <div className={`${s['material-form__group']} ${s['material-form__group--fixed']}`}>
              <label className={s['material-form__label']}>Moneda</label>
              <select className="input" value={form.moneda} onChange={(e) => handleMonedaChange(e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className={s['material-form__row']}>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Proveedor</label>
              <input className="input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
            </div>
            <div className={s['material-form__group']}>
              <label className={s['material-form__label']}>Stock disponible</label>
              <input className="input" type="number" min="0" value={form.stock_disponible} onChange={(e) => setForm({ ...form, stock_disponible: Number(e.target.value) })} />
            </div>
          </div>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Observaciones</label>
            <textarea className="input" rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </div>

          <div className={s['material-form__photo']}>
            <label className={s['material-form__photo-label']}>Foto del Material</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFotoSelect}
            />
            <div className={s['material-form__photo-row']}>
              {displayUrl ? (
                <div className={s['material-form__photo-preview']}>
                  <img src={displayUrl} alt="Vista previa" className={s['material-form__photo-img']} />
                  <button type="button" onClick={handleRemoveFoto} className={s['material-form__photo-remove']}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className={s['material-form__photo-empty']}>
                  <Camera size={32} color="#94a3b8" />
                </div>
              )}
              <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
                <Camera size={16} /> {existingFoto || fotoPreview ? 'Cambiar Foto' : 'Seleccionar Foto'}
              </button>
            </div>
            {selectedFile && <p className={s['material-form__file-info']}>{selectedFile.name}</p>}
          </div>

          <div className={s['material-form__actions']}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/materials')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Material')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
