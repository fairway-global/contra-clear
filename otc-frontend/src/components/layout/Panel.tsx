import { type ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function Panel({ title, children, className = '', action }: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
