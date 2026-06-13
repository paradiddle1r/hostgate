"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

/** Duration per kind, ms. Errors linger so HG codes can be read/copied. */
const DURATIONS: Record<ToastKind, number> = {
  success: 3500,
  info: 3500,
  error: 6000,
};

const ACCENTS: Record<ToastKind, string> = {
  success: "var(--app-success)",
  error: "var(--app-danger)",
  info: "var(--app-accent)",
};

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, kind, message }]);
      const timer = setTimeout(() => dismiss(id), DURATIONS[kind]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Sits BELOW the app header (h-14) so it never overlaps the top toolbar. */}
      <div className="pointer-events-none fixed right-4 top-[4.25rem] z-[70] flex w-[min(92vw,23rem)] flex-col gap-2.5">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className="app-toast-in app-toast-solid pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[var(--app-border)] py-3 pl-4 pr-2.5 text-sm text-[var(--app-fg)] shadow-2xl"
            >
              {/* coloured accent edge */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: ACCENTS[t.kind] }}
              />
              <Icon
                size={17}
                className="mt-px shrink-0"
                style={{ color: ACCENTS[t.kind] }}
              />
              <p className="min-w-0 flex-1 break-words leading-snug">
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-mt-0.5 shrink-0 rounded-lg p-1 text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/** Access the toast API. Must be called under a <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
