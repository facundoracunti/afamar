import { useCallback } from 'react';
import type { Pool } from '../types/poolStock';
import type { EntityFormState, FormField, PoolInForm } from '../types';
import { addPoolToList } from './entityFormHelpers';

interface UseFormPoolsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: FormField, value: unknown) => void;
  pools: Pool[];
}

interface UseFormPoolsReturn {
  handlePoolImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addPileta: (pid: string) => void;
  removePileta: (idx: number) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
}

/**
 * Composable: handles the "pileta" picker plus `pools_data` CRUD
 * (the "additional pool" stack). Also handles the pool image file
 * reader, encoding the image as a data URL into the form state.
 */
export function useFormPools({
  form,
  update,
  pools,
}: UseFormPoolsParams): UseFormPoolsReturn {
  const handlePoolImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => update('pool_image', ev.target?.result as string);
      reader.readAsDataURL(file);
    },
    [update]
  );

  const addPileta = useCallback(
    (pid: string) => {
      // eslint-disable-next-line no-console
      console.count('[addPileta]');
      const list = addPoolToList(form, pools, pid);
      if (list) update('pools_data', list);
    },
    [form, pools, update]
  );

  const removePileta = useCallback(
    (idx: number) => {
      const list = (form.pools_data as PoolInForm[]) || [];
      update('pools_data', list.filter((_, i) => i !== idx));
    },
    [form.pools_data, update]
  );

  const updatePileta = useCallback(
    (idx: number, field: string, value: unknown) => {
      const list = [...(form.pools_data as PoolInForm[])];
      (list[idx] as unknown as Record<string, unknown>)[field] = value;
      update('pools_data', list);
    },
    [form.pools_data, update]
  );

  return { handlePoolImage, addPileta, removePileta, updatePileta };
}