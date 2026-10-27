'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'danger' | 'success';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

// design/components.md, "Toast": a success disappears by itself, a danger stays until it is closed
const SUCCESS_DURATION_MS = 5000;

const toneClasses: Record<ToastTone, string> = {
  danger: 'bg-danger',
  success: 'bg-success',
};

interface Props {
  tone: ToastTone;
  onClose: () => void;
  children: ReactNode;
}

/** One message. `role` follows the urgency: an error is announced at once, a confirmation politely. */
export function Toast({ tone, onClose, children }: Props) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex w-full max-w-form items-center justify-between gap-md rounded-card p-md text-on-primary ${toneClasses[tone]}`}
    >
      <p>{children}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le message"
        className="h-control shrink-0 rounded-button px-sm font-medium text-on-primary"
      >
        ×
      </button>
    </div>
  );
}

interface ToastApi {
  showToast: (toast: { tone: ToastTone; message: string }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Shows the toasts of the whole application at the bottom of the page. Mounted once, in the root layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ tone, message }: { tone: ToastTone; message: string }) => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, tone, message }]);
      if (tone === 'success') {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          dismiss(id);
        }, SUCCESS_DURATION_MS);
        timers.current.add(timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-none bottom-none z-20 flex flex-col items-center gap-sm p-md">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto flex w-full justify-center">
            <Toast tone={toast.tone} onClose={() => dismiss(toast.id)}>
              {toast.message}
            </Toast>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
