import React, { Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getClients, searchClients, deleteClient } from '@/api/resources/clients';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { Modal } from '../../components/ui/Modal/Modal';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { useEntityList } from '../../hooks/useEntityList';
import styles from './ClientsListPage.module.css';

const ClientForm = React.lazy(() => import('./ClientFormPage'));

const s = styles as unknown as Record<string, string>;

type ClientModal = null | { kind: 'create' } | { kind: 'edit'; id: number };

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
  const navigate = useNavigate();
  const [modal, setModal] = useState<ClientModal>(null);
  const closeModal = () => setModal(null);

  const {
    items: clients,
    loading,
    total,
    page,
    pageSize,
    setPage,
    search,
    setSearch,
    deleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useEntityList<LocalClient, number>({
    queryKey: CLIENTS_KEY,
    listFetcher: async ({ skip, limit }) => {
      if (search.trim()) {
        const res = await searchClients(search.trim());
        const items = (res.data ?? []) as LocalClient[];
        return { ...res, data: items, pagination: { total: items.length, skip, limit } } as typeof res & {
          pagination: { total: number; skip: number; limit: number };
        };
      }
      return getClients({ skip, limit });
    },
    deleteFn: (id) => deleteClient(id),
    pageSize: 10,
    successMessage: 'Cliente eliminado correctamente',
    errorMessage: 'Error al eliminar cliente',
  });

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
            onClick={() => setModal({ kind: 'create' })}
          >
            <Plus size={16} /> Nuevo Cliente
          </button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nombre, teléfono o dirección..."
        leftIcon={<Search size={18} color="#94a3b8" />}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className={s['clients__table']}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Correo</th>
                <th>Direccion</th>
                <th style={{ textAlign: 'center' }}>Presupuestos</th>
                <th style={{ textAlign: 'center' }}>Órdenes</th>
                <th>Última orden</th>
                <th>Fecha alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className={s['clients__table-row']}
                  onClick={() => setModal({ kind: 'edit', id: c.id })}
                >
                  <td className={s['clients__id-cell']}>{c.id}</td>
                  <td className={s['clients__name-cell']}>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.address || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-pending">{c.total_budgets ?? 0}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-approved">{c.total_orders ?? 0}</span>
                  </td>
                  <td className={s['clients__meta-cell']}>{c.last_order_number || '-'}</td>
                  <td className={s['clients__meta-cell']}>{formatDate(c.created_at)}</td>
                  <td>
                    <div
                      className={s['clients__cell-actions']}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={`btn btn-outline ${s['clients__btn-sm']}`}
                        onClick={() => setModal({ kind: 'edit', id: c.id })}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className={`btn btn-danger ${s['clients__btn-sm']}`}
                        onClick={() => requestDelete(c.id)}
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
        open={deleteId !== null}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        title="Eliminar cliente"
        message="Estas seguro de eliminar este cliente? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="clientes" />

      <Suspense fallback={<LoadingSpinner />}>
        {modal && (
          <Modal
            isOpen
            onClose={closeModal}
            title={modal.kind === 'edit' ? 'Editar Cliente' : 'Nuevo Cliente'}
            width={modal.kind === 'edit' ? '820px' : '600px'}
          >
            {modal.kind === 'create' && (
              <ClientForm key="client-create" onSuccess={closeModal} onCancel={closeModal} />
            )}
            {modal.kind === 'edit' && (
              <ClientForm
                key={`client-edit-${modal.id}`}
                entityId={modal.id}
                onSuccess={closeModal}
                onCancel={closeModal}
              />
            )}
          </Modal>
        )}
      </Suspense>
    </div>
  );
}