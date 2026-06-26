import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Camera, Trash2 } from 'lucide-react';
import { getTrabajoRealizado, createTrabajoRealizado, updateTrabajoRealizado, uploadTrabajoFoto } from '../../services/api';
import Loading from '../../components/common/Loading';

export default function TrabajosRealizadosForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingFoto, setExistingFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    getTrabajoRealizado(id).then((res) => {
      const d = res.data as { titulo: string; descripcion?: string; foto?: string };
      setTitulo(d.titulo || '');
      setDescripcion(d.descripcion || '');
      if (d.foto) setExistingFoto(d.foto);
    }).finally(() => setLoading(false));
  }, [id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateTrabajoRealizado(id, { titulo: titulo.trim(), descripcion: descripcion.trim() || null });
        if (selectedFile) await uploadTrabajoFoto(id, selectedFile);
      } else {
        const res = await createTrabajoRealizado({ titulo: titulo.trim(), descripcion: descripcion.trim() || null });
        const created = res.data as { id: number };
        if (selectedFile) await uploadTrabajoFoto(created.id, selectedFile);
      }
      navigate('/admin/trabajos-realizados');
    } catch { }
    setSaving(false);
  };

  if (loading) return <Loading />;

  const displayUrl = fotoPreview || (existingFoto ? `/${existingFoto}` : null);

  return (
    <div>
      <h1>{isEdit ? 'Editar Trabajo' : 'Nuevo Trabajo'}</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 600, marginTop: 20 }}>
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input
            type="text"
            className="form-control"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            placeholder="Ej: Mesada de granito San Gabriel"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea
            className="form-control"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción del trabajo realizado"
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 20 }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Foto del Trabajo</label>
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

        <div style={{ marginTop: 24 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !titulo.trim()}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="btn btn-outline" style={{ marginLeft: 8 }} onClick={() => navigate('/admin/trabajos-realizados')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
