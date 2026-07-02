import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getClients, deleteClient } from '@/api/resources/clients';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './ClientsListPage.module.css';

const s = styles as unknown as Record<string, string>;

// Local interface — replaces the Spanish-named `Cliente` from types/cliente
interface Client {
  id: number;
  nombre?: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  total_ordenes?: number;
  ultima_orden?: string | null;
  created_at?: string | null;
}

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getClients({ search: search || undefined }).then((res) => {
      setClients((res.data as Client[]) || []);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteClient(deleteId);
    setDeleteId(null);
    load();
  };

  const formatDate = (d: string | null | undefined): string => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className={s['clients']}>
      <div className={s['clients__header']}>
        <h1 className={s['clients__title']}>Clientes</h1>
        <div className={s['clients__actions']}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/clients/new')}
          >
            <Plus size={16} /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className={s['clients__search']}>
        <Search size={18} color="#94a3b8" />
        <input
          className="input"
          placeholder="Buscar por nombre, telefono o direccion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className={s['clients__table']}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Direccion</th>
                <th style={{ textAlign: 'center' }}>Ordenes</th>
                <th>Ultima orden</th>
                <th>Fecha alta</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/clients/${c.id}`)}
                >
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{c.id}</td>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td>{c.telefono || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.direccion || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-approved">{c.total_ordenes || 0}</span>
                  </td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{c.ultima_orden || '-'}</td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{formatDate(c.created_at)}</td>
                  <td>
                    <div
                      className={s['clients__cell-actions']}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 8px' }}
                        onClick={() => navigate(`/admin/clients/${c.id}`)}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '4px 8px' }}
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={9} className={s['clients__empty']}>
                    No hay clientes registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message="Estas seguro de eliminar este cliente? Esta accion no se puede deshacer."
      />
    </div>
  );
}
