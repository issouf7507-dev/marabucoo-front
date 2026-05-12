import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  isLoading: boolean;
  error: unknown;
  colSpan?: number;
}

export function QueryRows({ isLoading, error, colSpan = 6 }: Props) {
  if (isLoading) return (
    <tr><td colSpan={colSpan} className="empty" style={{ color: 'var(--tx3)' }}>
      <Loader2 size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, animation: 'spin 1s linear infinite' }} />
      Chargement…
    </td></tr>
  );
  if (error) return (
    <tr><td colSpan={colSpan} className="empty" style={{ color: 'var(--R)' }}>
      <AlertTriangle size={14} strokeWidth={2} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }} />
      {error instanceof Error ? error.message : 'Erreur de chargement'}
    </td></tr>
  );
  return null;
}

export function QueryCard({ isLoading, error }: Omit<Props, 'colSpan'>) {
  if (isLoading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--tx3)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Loader2 size={18} strokeWidth={2} color="var(--G)" style={{ animation: 'spin 1s linear infinite' }} />
      Chargement…
    </div>
  );
  if (error) return (
    <div className="alert r" style={{ margin: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <AlertTriangle size={14} strokeWidth={2} />
      {error instanceof Error ? error.message : 'Erreur de chargement'}
    </div>
  );
  return null;
}
