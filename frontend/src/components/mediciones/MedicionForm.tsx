import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, Plus } from 'lucide-react';
import { getMedicion, createMedicion, updateMedicion } from '../../services/api';
import { estadosMedicion } from '../../utils/formatters';
import type { Medicion, MedicionFormData } from '../../types/medicion';
import Loading from '../common/Loading';

export default function MedicionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<MedicionFormData>({
    cliente_nombre: '',
    cliente_telefono: '',
    cliente_direccion: '',
    fecha_programada: '',
    hora_programada: '',
    observaciones: '',
    croquis: [],
    fotos: [],
    estado: 'PENDIENTE',
  });

  useEffect(() => {
    if (id) {
      getMedicion(id).then((res: { data: Medicion }) => {
        const d = res.data;
        setForm({
          cliente_nombre: d.cliente_nombre || '',
          cliente_telefono: d.cliente_telefono || '',
          cliente_direccion: d.cliente_direccion || '',
          fecha_programada: d.fecha_programada ? d.fecha_programada.split('T')[0] : '',
          hora_programada: d.hora_programada || '',
          observaciones: d.observaciones || '',
          croquis: d.croquis || [],
          fotos: d.fotos || [],
          estado: d.estado || 'PENDIENTE',
        });
        setFotosPreview(d.fotos || []);
        setLoading(false);
      });
    }
  }, [id]);

  const handleChange = (field: keyof MedicionFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files as FileList);
    const readers = files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((base64s: string[]) => {
      const newFotos = [...form.fotos, ...base64s];
      setForm({ ...form, fotos: newFotos });
      setFotosPreview(newFotos);
    });
    e.target.value = '';
  };

  const handleRemoveFoto = (index: number): void => {
    const newFotos = form.fotos.filter((_: string, i: number) => i !== index);
    setForm({ ...form, fotos: newFotos });
    setFotosPreview(newFotos);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        fecha_programada: form.fecha_programada ? new Date(form.fecha_programada).toISOString() : null,
      };
      if (isEdit) {
        await updateMedicion(id as string, payload);
      } else {
        await createMedicion(payload);
      }
      navigate('/mediciones');
    } catch (err: unknown) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{isEdit ? 'Editar Medición' : 'Nueva Medición'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ maxWidth: 700 }}>
          <div className="form-row">
            <div className="form-group"><label>Cliente *</label><input className="input" required value={form.cliente_nombre} onChange={handleChange('cliente_nombre')} /></div>
            <div className="form-group"><label>Teléfono</label><input className="input" value={form.cliente_telefono} onChange={handleChange('cliente_telefono')} /></div>
          </div>
          <div className="form-group"><label>Dirección</label><input className="input" value={form.cliente_direccion} onChange={handleChange('cliente_direccion')} /></div>
          <div className="form-row">
            <div className="form-group"><label>Fecha programada</label><input className="input" type="date" value={form.fecha_programada} onChange={handleChange('fecha_programada')} /></div>
            <div className="form-group"><label>Hora programada</label><input className="input" type="time" value={form.hora_programada} onChange={handleChange('hora_programada')} /></div>
          </div>
          <div className="form-group"><label>Observaciones</label><textarea className="input" rows={3} value={form.observaciones} onChange={handleChange('observaciones')} /></div>
          <div className="form-group">
            <label>Estado</label>
            <select className="input" value={form.estado} onChange={handleChange('estado')}>
              {estadosMedicion.map((e: string) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Fotos</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Plus size={16} /> Agregar fotos
            </button>
            {fotosPreview.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {fotosPreview.map((foto: string, idx: number) => (
                  <div key={idx} style={{ position: 'relative', width: 100, height: 100 }}>
                    <img src={foto} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveFoto(idx)}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                        border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 } as React.CSSProperties}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/mediciones')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Medición')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
