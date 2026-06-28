import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
}

export function MenuSheet({ title, onClose, children, headerAction }: Props) {
  return (
    <div className="sheet-overlay menu-sheet-overlay" onClick={onClose}>
      <div className="menu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="menu-sheet-header">
          <button type="button" className="menu-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <h2 className="menu-sheet-title">{title}</h2>
          {headerAction && <div className="menu-sheet-action">{headerAction}</div>}
        </div>
        <div className="menu-sheet-body">{children}</div>
      </div>
    </div>
  );
}
