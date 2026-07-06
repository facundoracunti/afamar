import React from 'react';
import { useParams } from 'react-router-dom';
import MaterialForm from '../../components/materials/MaterialForm/MaterialForm';
import styles from './MaterialFormPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function MaterialFormPage() {
  const { id } = useParams();
  const isEdit = !!id;

  return (
    <div className={s['material-form']}>
      <h1 className={s['material-form__title']}>{isEdit ? 'Editar Material' : 'Nuevo Material'}</h1>
      <MaterialForm materialId={id} />
    </div>
  );
}
