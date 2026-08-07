import React, { useMemo, useState } from 'react';
import type { Material } from '../../../types/material';
import type { MaterialCategory } from '../../../api/resources/materials';

interface MaterialPickerControlsProps {
  /** Reference materials to pick from (the picker's options). */
  materials: Material[];
  /** Categories for the category filter (fetched once by the parent). */
  categorias: MaterialCategory[];
  readOnly?: boolean;
  /** Called with the picked catalogue material. */
  onPick: (mat: Material) => void;
  /** Label for the picker's "nothing selected" option. */
  placeholder?: string;
}

/**
 * Shared category + color + material picker used both by the MATERIALES
 * section header (add material) and by each MaterialCard's "Cambiar
 * material" toggle. Renders as a Fragment so the three `<select>`s drop
 * straight into the parent's CSS grid.
 */
export default function MaterialPickerControls({
  materials,
  categorias,
  readOnly,
  onPick,
  placeholder = '+ AGREGAR MATERIAL',
}: MaterialPickerControlsProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [pickValue, setPickValue] = useState('');

  const colorOptions = useMemo<string[]>(
    () => [...new Set((materials || []).map((m) => m.color).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [materials],
  );

  const filteredMaterials = useMemo(() => {
    return (materials || []).filter((m) => {
      if (selectedCategoryId && String(m.category_id ?? '') !== selectedCategoryId) return false;
      if (selectedColor && m.color !== selectedColor) return false;
      return true;
    });
  }, [materials, selectedCategoryId, selectedColor]);

  return (
    <>
      <select
        className="input"
        value={selectedCategoryId}
        onChange={(e) => setSelectedCategoryId(e.target.value)}
        disabled={readOnly}
        aria-label="Filtrar materiales por categoría"
      >
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
      </select>
      <select
        className="input"
        value={selectedColor}
        onChange={(e) => setSelectedColor(e.target.value)}
        disabled={readOnly}
        aria-label="Filtrar materiales por color"
      >
        <option value="">Todos los colores</option>
        {colorOptions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        className="input"
        value={pickValue}
        onChange={(e) => {
          const id = e.target.value;
          setPickValue('');
          const mat = filteredMaterials.find((m) => String(m.id) === id);
          if (mat) onPick(mat);
        }}
        disabled={readOnly}
      >
        <option value="">{placeholder}</option>
        {filteredMaterials.filter((m) => m.name).map((m) => (
          <option key={m.id} value={String(m.id)}>
            {m.name}{m.color ? ` - ${m.color}` : ''}
          </option>
        ))}
      </select>
    </>
  );
}
