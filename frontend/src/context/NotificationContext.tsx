import { createContext, useCallback, useContext, useState } from "react";
import styles from "./NotificationContext.module.css";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface NotificationContextType {
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

let nextId = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const typeClass = (t: ToastType) => {
    if (t === "success") return styles["toast--success"];
    if (t === "error") return styles["toast--error"];
    return styles["toast--info"];
  };

  return (
    <NotificationContext.Provider value={{ toasts, notify }}>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${typeClass(t.type)}`}
            onClick={() => dismiss(t.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") dismiss(t.id); }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotify must be inside NotificationProvider");
  return ctx.notify;
}
