import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export function useConfirm() {
  const [state, setState] = useState<{ resolve: (v: boolean) => void; title: string; message: string; danger?: boolean } | null>(null);

  const confirm = (message: string, title = "Confirmar", danger?: boolean): Promise<boolean> =>
    new Promise((resolve) => { setState({ resolve, title, message, danger }); });

  const dialog = state ? (
    <ConfirmDialog
      open
      title={state.title}
      message={state.message}
      danger={state.danger}
      onConfirm={() => { state.resolve(true); setState(null); }}
      onCancel={() => { state.resolve(false); setState(null); }}
    />
  ) : null;

  return { confirm, dialog };
}
