import type { ReactNode } from 'react';

interface ModalShellProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  widthClassName?: string;
}

export default function ModalShell({
  open,
  title,
  children,
  onClose,
  footer,
  widthClassName = 'max-w-2xl',
}: ModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-terminal-bg/80 px-4">
      <div className={`panel w-full ${widthClassName} shadow-2xl`}>
        <div className="panel-header">
          <span className="panel-title">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-terminal-dim transition-colors hover:text-terminal-text"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="border-t border-terminal-border px-4 py-3">
            <div className="flex items-center justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
