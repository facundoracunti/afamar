import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getClientes, deleteCliente } from '../../services/api';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';

export default function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getClientes({ search: search || undefined }).then((res) => {
      setClientes(res.data);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCliente(deleteId);
    setDeleteId(null);
    load();
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Clientes</h1>
        <button className="btn btn-primary" onClick={() => navigate('/clientes/nuevo')}>
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" placeholder="Buscar por nombre, teléfono o dirección..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Dirección</th>
                  <th style={{ textAlign: 'center' }}>Órdenes</th>
                  <th>Última orden</th>
                  <th>Fecha alta</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td>{c.telefono || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.direccion || '-'}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-approved">{c.total_ordenes || 0}</span></td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{c.ultima_orden || '-'}</td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{formatDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                          <Edit size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setDeleteId(c.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay clientes registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar cliente" message="¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer." />
    </div>
  );
}