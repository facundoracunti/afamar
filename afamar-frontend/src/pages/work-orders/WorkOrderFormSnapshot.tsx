import React from 'react';
import type { EntityFormState } from '../../types';

interface WorkOrderFormSnapshotProps {
  form: EntityFormState;
  readOnly: boolean;
}

export default function WorkOrderFormSnapshot({
  form: _form,
  readOnly: _readOnly,
}: WorkOrderFormSnapshotProps) {
  return null;
}
