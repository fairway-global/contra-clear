import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  widthClassName = 'max-w-2xl',
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`panel w-full ${widthClassName} overflow-hidden shadow-2xl`}>
        <div className="panel-header">
          <span className="panel-title">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-terminal-border px-2 py-1 font-mono text-xs text-terminal-dim transition-colors hover:border-terminal-accent hover:text-terminal-accent"
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? <div className="border-t border-terminal-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
