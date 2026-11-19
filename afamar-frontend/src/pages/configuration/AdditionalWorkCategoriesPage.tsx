import React, { useCallback, useEffect, useState } from 'react';
import { Save, Trash2, Plus } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { parseApiError } from '../../utils/error';
import type { AdditionalWorkCategory } from '../../types/additionalWork';
import { getAdditionalWorks, updateAdditionalWork } from '../../api/resources/additionalWorks';
import { createAdditionalWorkCategory, deleteAdditionalWorkCategory, getAdditionalWorkCategories, updateAdditionalWorkCategory } from '../../api/resources/additionalWorkCategories';

export default function AdditionalWorkCategoriesPage() {
  const [categories, setCategories] = useState<AdditionalWorkCategory[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [newName, setNewName] = useState('');
  const notify = useNotify();
  const reload = useCallback(
    () => getAdditionalWorkCategories().then(setCategories).catch((err) => notify(parseApiError(err, 'Error al cargar categorías'), 'error')),
    [notify],
  );
  useEffect(() => { reload(); }, [reload]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try { await createAdditionalWorkCategory({ name, sort_order: categories.length }); setNewName(''); await reload(); notify('Categoría creada', 'success'); }
    catch (err: unknown) { notify(parseApiError(err, 'Error al crear categoría'), 'error'); }
  };
  const rename = async (category: AdditionalWorkCategory) => {
    const name = (drafts[category.id] ?? category.name).trim();
    if (!name || name === category.name) return;
    try { await updateAdditionalWorkCategory(category.id, { name }); await reload(); notify('Categoría actualizada', 'success'); }
    catch (err: unknown) { notify(parseApiError(err, 'Error al actualizar categoría'), 'error'); }
  };
  const remove = async (category: AdditionalWorkCategory) => {
    try {
      let result;
      try {
        result = await deleteAdditionalWorkCategory(category.id);
      } catch (firstError: unknown) {
        // Compatibility with an older backend instance that still blocks
        // deletion: reassign its rows from the client, then retry once.
        if (!String(firstError instanceof Error ? firstError.message : firstError).toLowerCase().includes('usando')) throw firstError;
        const works = await getAdditionalWorks({ skip: 0, limit: 1000 });
        const fallback = categories.find((item) => item.name.toLocaleLowerCase('es') === 'otros' && item.id !== category.id)
          ?? categories.find((item) => item.id !== category.id);
        if (!fallback) throw firstError;
        await Promise.all(works.filter((work) => work.category === category.name).map((work) => updateAdditionalWork(work.id, { category: fallback.name })));
        result = await deleteAdditionalWorkCategory(category.id);
      }
      await reload();
      notify(result.reassigned ? `Eliminada. ${result.reassigned} trabajos reasignados automáticamente.` : 'Categoría eliminada', 'success');
    } catch (err: unknown) { notify(parseApiError(err, 'No se puede eliminar la categoría'), 'error'); }
  };

  return <div className="configuration">
    <div className="configuration__header"><h1 className="configuration__title">Categorías de trabajos adicionales</h1></div>
    <div className="configuration__card">
      <p>Estas categorías se guardan en la base de datos y aparecen como filtros al cargar un presupuesto.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej.: Traforos" style={{ maxWidth: 300 }} />
        <button className="btn btn-primary" onClick={create} disabled={!newName.trim()}><Plus size={16} /> Crear categoría</button>
      </div>
      <div style={{ display: 'grid', gap: 8, maxWidth: 700 }}>
        {categories.map((category) => <div key={category.id} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={drafts[category.id] ?? category.name} onChange={(e) => setDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))} />
          <button className="btn btn-outline" onClick={() => rename(category)} title="Guardar nombre"><Save size={15} /></button>
          <button className="btn btn-danger" onClick={() => remove(category)} title="Eliminar categoría"><Trash2 size={15} /></button>
        </div>)}
      </div>
    </div>
  </div>;
}
