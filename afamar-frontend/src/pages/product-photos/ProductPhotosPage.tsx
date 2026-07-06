import { useRef, useState } from 'react';
import { useList, useCreate, useUpdate, useDelete } from '@/api/hooks';
import { getLatestProductPhotos, createProductPhoto, updateProductPhoto, deleteProductPhoto } from '@/api/resources/productPhotos';
import { Modal } from '@/components/ui/Modal/Modal';
import { useConfirm } from '@/components/ui/useConfirm/useConfirm';
import { useNotify } from '@/context/NotificationContext';
import type { ProductPhoto } from '@/types';
import styles from './ProductPhotosPage.module.css';

const s = styles as unknown as Record<string, string>;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 30 * 1024 * 1024;

export default function ProductPhotosPage() {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();
  const notify = useNotify();

  const { items: photos, loading, error, load } = useList<ProductPhoto>(
    ['productPhotos'],
    () => getLatestProductPhotos(12).then(r => r.data),
  );

  const createMutation = useCreate(['productPhotos'], (fd: FormData) =>
    createProductPhoto(fd).then(r => r.data),
    { invalidateKeys: [['productPhotos']] },
  );

  const updateMutation = useUpdate(['productPhotos'], ({ id, data }: { id: number; data: Record<string, unknown> }) =>
    updateProductPhoto(id, data).then(r => r.data),
    { invalidateKeys: [['productPhotos']] },
  );

  const deleteMutation = useDelete(['productPhotos'], (id: number) =>
    deleteProductPhoto(id).then(r => r.data),
    { invalidateKeys: [['productPhotos']] },
  );

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Formato no permitido. Usá JPG, PNG o WebP.';
    if (file.size > MAX_SIZE) return 'La imagen supera los 30MB.';
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const err = validateFile(file);
      if (err) {
        notify(err, 'error');
        e.target.value = '';
        return;
      }
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', title);
      fd.append('description', description);
      await createMutation.mutateAsync(fd);
      notify('Foto subida correctamente', 'success');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) {
      notify(e.message || 'Error al subir foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm('¿Eliminar esta foto?', 'Eliminar', true))) return;
    try {
      await deleteMutation.mutateAsync(id);
      notify('Foto eliminada', 'success');
      load();
    } catch (e: any) {
      notify(e.message || 'Error al eliminar foto', 'error');
    }
  };

  const startEdit = (photo: ProductPhoto) => {
    setEditingId(photo.id);
    setEditTitle(photo.title || '');
    setEditDesc(photo.description || '');
  };

  const saveEdit = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, data: { title: editTitle, description: editDesc } });
      notify('Foto actualizada', 'success');
      setEditingId(null);
      load();
    } catch (e: any) {
      notify(e.message || 'Error al actualizar', 'error');
    }
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className={s['product-photos']}>
      <h2 className={s['product-photos__title']}>Fotos de productos</h2>

      {dialog}

      <div className={s['product-photos__upload']}>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
        <input className={s['product-photos__input']} type="text" placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={s['product-photos__input']} type="text" placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className={s['product-photos__submit']} disabled={!selectedFile || uploading} onClick={handleUpload}>
          {uploading ? 'Subiendo...' : 'Subir foto'}
        </button>
      </div>

      {error && <div className={s['product-photos__error']}>{error}</div>}

      {loading ? (
        <div className={s['product-photos__loading']}>Cargando...</div>
      ) : photos.length === 0 ? (
        <div className={s['product-photos__empty']}>No hay fotos cargadas</div>
      ) : (
        <div className={s['product-photos__grid']}>
          {photos.map((photo) => (
            <div key={photo.id} className={s['product-photos__card']}>
              <img
                className={s['product-photos__img']}
                src={photo.file_path}
                alt={photo.title || ''}
                onClick={() => setLightboxImg(photo.file_path)}
              />
              <div className={s['product-photos__info']}>
                {editingId === photo.id ? (
                  <div className={s['product-photos__edit-form']}>
                    <input className={s['product-photos__input']} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título" />
                    <input className={s['product-photos__input']} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descripción" />
                    <div className={s['product-photos__edit-actions']}>
                      <button className={s['product-photos__save-btn']} onClick={() => saveEdit(photo.id)}>Guardar</button>
                      <button className={s['product-photos__cancel-btn']} onClick={cancelEdit}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {photo.title && <strong>{photo.title}</strong>}
                    {photo.description && <span>{photo.description}</span>}
                    <div className={s['product-photos__actions']}>
                      <button className={s['product-photos__edit-btn']} onClick={() => startEdit(photo)}>Editar</button>
                      <button className={s['product-photos__delete-btn']} onClick={() => handleDelete(photo.id)}>Eliminar</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!lightboxImg} onClose={() => setLightboxImg(null)} width="900px">
        {lightboxImg && <img src={lightboxImg} alt="" className={s['product-photos__lightbox-img']} />}
      </Modal>
    </div>
  );
}
