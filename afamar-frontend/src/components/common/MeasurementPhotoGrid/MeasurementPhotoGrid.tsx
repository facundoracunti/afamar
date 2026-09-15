/**
 * Photo management grid for MeasurementFormPage.
 * Renders a hidden file input trigger + photo thumbnail grid with remove buttons.
 * Clicking a thumbnail opens a lightbox with the full-size image.
 */

import React, { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import styles from './MeasurementPhotoGrid.module.css';

const s = styles as unknown as Record<string, string>;

interface MeasurementPhotoGridProps {
  fotos: string[];
  onAddFotos: (fotos: string[]) => void;
  onRemoveFoto: (index: number) => void;
}

export function MeasurementPhotoGrid({ fotos, onAddFotos, onRemoveFoto }: MeasurementPhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lightboxFoto, setLightboxFoto] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files as FileList);
    const readers = files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((base64s: string[]) => {
      onAddFotos([...fotos, ...base64s]);
    });
    e.target.value = '';
  };

  return (
    <div className={s['photo-grid']}>
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
      {fotos.length > 0 && (
        <div className={s['photo-grid__photos']}>
          {fotos.map((foto: string, idx: number) => (
            <div key={idx} className={s['photo-grid__photo']}>
              <img
                src={foto}
                alt={`Foto ${idx + 1}`}
                className={s['photo-grid__photo-img']}
                onClick={() => setLightboxFoto(foto)}
              />
              <button
                type="button"
                className={s['photo-grid__photo-remove']}
                onClick={() => onRemoveFoto(idx)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={lightboxFoto !== null} onClose={() => setLightboxFoto(null)} width="900px">
        {lightboxFoto && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src={lightboxFoto}
              alt="Foto de la medición"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
