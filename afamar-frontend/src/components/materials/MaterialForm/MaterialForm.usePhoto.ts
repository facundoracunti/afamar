/**
 * `MaterialForm` — photo (upload / preview / delete) state.
 *
 * Owns the object-URL lifecycle of the selected photo: the preview URL is
 * revoked when it changes and when the component unmounts.
 */
import { useEffect, useState } from 'react';
import { deleteMaterialPhoto } from '@/api/resources/materials';

export interface MaterialPhotoState {
  selectedFile: File | null;
  fotoPreview: string | null;
  existingFoto: string | null;
  deletingPhoto: boolean;
  handleFotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFoto: () => Promise<void>;
  setExistingFoto: (foto: string | null) => void;
}

export function useMaterialPhoto(params: {
  materialId?: number | string;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}): MaterialPhotoState {
  const { materialId, notify } = params;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingFoto, setExistingFoto] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

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

  const handleRemoveFoto = async () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(null);
    setFotoPreview(null);
    if (materialId && existingFoto) {
      try {
        setDeletingPhoto(true);
        await deleteMaterialPhoto(materialId);
        setExistingFoto(null);
      } catch (err) {
        const detail = (err as { message?: string })?.message ?? 'No se pudo eliminar la foto';
        notify(detail, 'error');
      } finally {
        setDeletingPhoto(false);
      }
    } else {
      setExistingFoto(null);
    }
  };

  return {
    selectedFile,
    fotoPreview,
    existingFoto,
    deletingPhoto,
    handleFotoSelect,
    handleRemoveFoto,
    setExistingFoto,
  };
}
