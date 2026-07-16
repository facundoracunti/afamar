import React, { useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import styles from '../MaterialForm/MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

interface MaterialPhotoUploaderProps {
  existingFoto: string | null;
  selectedFile: File | null;
  fotoPreview: string | null;
  deletingPhoto: boolean;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

export function MaterialPhotoUploader({
  existingFoto,
  selectedFile,
  fotoPreview,
  deletingPhoto,
  onSelect,
  onRemove,
}: MaterialPhotoUploaderProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const displayUrl = fotoPreview || (existingFoto ? existingFoto : null);

  return (
    <div className={s['material-form__photo']}>
      <label className={s['material-form__photo-label']}>Foto del Material</label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onSelect}
      />
      <div className={s['material-form__photo-row']}>
        {displayUrl ? (
          <div className={s['material-form__photo-preview']}>
            <img src={displayUrl} alt="Vista previa" className={s['material-form__photo-img']} />
            <button
              type="button"
              onClick={onRemove}
              disabled={deletingPhoto}
              className={s['material-form__photo-remove']}
              title="Eliminar foto"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className={s['material-form__photo-empty']}>
            <Camera size={32} color="#94a3b8" />
          </div>
        )}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={16} /> {existingFoto || fotoPreview ? 'Cambiar Foto' : 'Seleccionar Foto'}
        </button>
      </div>
      {selectedFile && <p className={s['material-form__file-info']}>{selectedFile.name}</p>}
    </div>
  );
}
