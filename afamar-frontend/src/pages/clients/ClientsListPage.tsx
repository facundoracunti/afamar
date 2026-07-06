import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getClients, deleteClient } from '@/api/resources/clients';
import { usePaginatedList, useDelete } from '../../api/hooks';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { useNotify } from '../../context/NotificationContext';
import styles from './ClientsListPage.module.css';

const s = styles as unknown as Record<string, string>;

// Local interface — `total_budgets`, `total_orders`, `last_order_number`
// are filled by the backend list endpoint (see ClientService.list_with_stats).
interface LocalClient {
  id: number;
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  total_budgets?: number;
  total_orders?: number;
  last_order_number?: string | null;
  created_at?: string | null;
}

const CLIENTS_KEY = ['clients'] as const;

export default function ClientsList() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();

  const { items: clients, loading, total, page, pageSize, setPage } = usePaginatedList<LocalClient>(
    [...CLIENTS_KEY, search],
    async ({ skip, limit }) => {
      return getClients({ search: search || undefined, skip, limit });
    },
    { pageSize: 10 },
  );

  const deleteMutation = useDelete<unknown, number>(
    CLIENTS_KEY,
    async (id) => {
      await deleteClient(id);
    },
    { invalidateKeys: [CLIENTS_KEY] }
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
      notify('Cliente eliminado correctamente', 'success');
    } catch (err) {
      notify((err as Error).message || 'Error al eliminar cliente', 'error');
    }
  };

  const formatDate = (d: string | null | undefined): string => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className={s['clients']}>
      <PageHeader
        title="Clientes"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/clients/new')}
          >
            <Plus size={16} /> Nuevo Cliente
          </button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nombre, telefono o direccion..."
        leftIcon={<Search size={18} color="#94a3b8" />}
      />

      {loading ? (
        <LoadingSpinner />
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
                <th style={{ textAlign: 'center' }}>Presupuestos</th>
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
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.address || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-pending">{c.total_budgets ?? 0}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-approved">{c.total_orders ?? 0}</span>
                  </td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{c.last_order_number || '-'}</td>
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
                  <td colSpan={10}>
                    <EmptyState message="No hay clientes registrados" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message="Estas seguro de eliminar este cliente? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="clientes" />
    </div>
  );
}
