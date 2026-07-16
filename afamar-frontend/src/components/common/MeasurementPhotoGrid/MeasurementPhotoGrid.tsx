/**
 * Photo management grid for MeasurementFormPage.
 * Renders a hidden file input trigger + photo thumbnail grid with remove buttons.
 */

import React, { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import styles from './MeasurementPhotoGrid.module.css';

const s = styles as unknown as Record<string, string>;

interface MeasurementPhotoGridProps {
  fotos: string[];
  onAddFotos: (fotos: string[]) => void;
  onRemoveFoto: (index: number) => void;
}

export function MeasurementPhotoGrid({ fotos, onAddFotos, onRemoveFoto }: MeasurementPhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
              <img src={foto} alt={`Foto ${idx + 1}`} className={s['photo-grid__photo-img']} />
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
    </div>
  );
}
