import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getTrabajosRealizados, deleteTrabajoRealizado } from '../../services/api';
import type { TrabajoRealizado } from '../../types/trabajoRealizado';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';

export default function TrabajosRealizadosList() {
  const [data, setData] = useState<TrabajoRealizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getTrabajosRealizados({ search: search || undefined }).then((res) => {
      setData(res.data as TrabajoRealizado[]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTrabajoRealizado(deleteId);
      setData((prev) => prev.filter((d) => d.id !== deleteId));
    } catch { }
    setDeleteId(null);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Trabajos Realizados</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/trabajos-realizados/nuevo')}>
          <Plus size={16} /> Nuevo Trabajo
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 10, top: 8, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e2e8f0', borderRadius: 6 }}
          />
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Foto</th>
            <th>Descripción</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Sin trabajos registrados</td></tr>
          ) : (
            data.filter((d) => !search || d.titulo.toLowerCase().includes(search.toLowerCase()))
              .map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.titulo}</td>
                  <td>
                    {d.foto ? (
                      <img src={`/${d.foto}`} alt="" style={{ width: 50, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>Sin foto</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.descripcion || '-'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{d.created_at?.split('T')[0] || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => navigate(`/admin/trabajos-realizados/${d.id}`)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-outline" style={{ color: '#dc2626' }} onClick={() => setDeleteId(d.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar trabajo"
        message="¿Estás seguro de eliminar este trabajo realizado?"
      />
    </div>
  );
}
