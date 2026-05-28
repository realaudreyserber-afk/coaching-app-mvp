"use client";

/**
 * ConfirmDialog — confirmation stylée NoDream Tactical OS, en remplacement du
 * `window.confirm()` natif (boîte grise du navigateur, hors design).
 *
 * Usage :
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: "Supprimer ?", danger: true }))) return;
 *
 * Le `ConfirmProvider` est monté une fois (cf. app/(app)/layout.tsx) et rend la
 * modale. Le hook renvoie une Promise<boolean> résolue à la décision de l'user.
 * A11y : role="dialog", aria-modal, Escape = annuler, focus auto sur l'action,
 * clic backdrop = annuler.
 */

import * as React from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style rouge pour les actions destructives (suppression, abandon). */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  // Repli défensif sur le confirm natif si le provider n'est pas monté.
  if (!ctx) {
    return (opts) => Promise.resolve(window.confirm(opts.message));
  }
  return ctx;
}

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const settle = React.useCallback(
    (result: boolean) => {
      setPending((cur) => {
        cur?.resolve(result);
        return null;
      });
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmModal
          opts={pending.opts}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmModal({
  opts,
  onConfirm,
  onCancel,
}: {
  opts: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  const accent = opts.danger ? "var(--alert-500)" : "var(--accent-tech)";
  const accentTint = opts.danger ? "var(--alert-tint-15)" : "var(--accent-tech-tint)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={opts.title ?? "Confirmation"}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6,3,15,0.80)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--glass-bg-3)",
          border: `1px solid ${accent}`,
          boxShadow: `0 0 36px ${accentTint}`,
          padding: "20px 22px",
          clipPath:
            "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            color: accent,
            textTransform: "uppercase",
            display: "block",
            marginBottom: 10,
          }}
        >
          [{opts.danger ? "ACTION CRITIQUE" : "CONFIRMATION"}]
        </span>

        {opts.title && (
          <h3
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 800,
              fontSize: 17,
              color: "var(--fg-1)",
              margin: "0 0 8px 0",
              letterSpacing: "-0.01em",
            }}
          >
            {opts.title}
          </h3>
        )}

        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--fg-2)", margin: 0 }}>
          {opts.message}
        </p>

        <div className="flex items-center justify-end gap-3" style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost mono"
            style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", padding: "8px 16px" }}
          >
            {opts.cancelLabel ?? "Annuler"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "9px 18px",
              background: accentTint,
              border: `1px solid ${accent}`,
              color: accent,
              cursor: "pointer",
              clipPath:
                "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
            }}
          >
            {opts.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
