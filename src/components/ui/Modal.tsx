import type { ReactNode } from 'react';
import { X, Save } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  width?: number;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, onSave, saveLabel = 'Enregistrer', saving, width = 640, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="mbo on" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mod" style={{ width }}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="mx" onClick={onClose} title="Fermer">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="mbody">{children}</div>
        {onSave && (
          <div className="mf">
            <button className="btn" onClick={onClose}>Annuler</button>
            <button className="btn prim" onClick={onSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? .7 : 1 }}>
              <Save size={14} strokeWidth={2} />
              {saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
