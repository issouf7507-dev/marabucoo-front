import { useState, useEffect, useRef } from 'react';
import { useClients, useCreateClient } from '../../hooks/queries/useClients';

interface Props {
  value: string;
  onChange: (nom: string) => void;
  error?: string;
}

export default function ClientPicker({ value, onChange, error }: Props) {
  const [query, setQuery]     = useState(value);
  const [open, setOpen]       = useState(false);
  const [createErr, setCreateErr] = useState('');
  const ref                   = useRef<HTMLDivElement>(null);

  const { data: clients = [] } = useClients();
  const createClient           = useCreateClient();

  // Sync query when the form is reset from outside (e.g. openEdit / openNew)
  useEffect(() => { setQuery(value); }, [value]);

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = clients
    .filter(c => c.nom.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const exactMatch = clients.some(c => c.nom.toLowerCase() === query.trim().toLowerCase());
  const showCreate = query.trim().length > 0 && !exactMatch;

  async function handleCreate() {
    const nom = query.trim();
    if (!nom || createClient.isPending) return;
    setCreateErr('');
    try {
      const client = await createClient.mutateAsync({ nom });
      onChange(client.nom);
      setQuery(client.nom);
      setOpen(false);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Erreur lors de la création');
    }
  }

  function handleSelect(nom: string) {
    onChange(nom);
    setQuery(nom);
    setOpen(false);
  }

  const showDrop = open && (filtered.length > 0 || showCreate);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        className={`inp${error ? ' inp-err' : ''}`}
        value={query}
        autoComplete="off"
        placeholder="Rechercher ou créer un client…"
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />

      {showDrop && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--sur)', border: '1px solid var(--bor2)', borderRadius: 'var(--r)',
          boxShadow: 'var(--sh2)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(c => (
            <div
              key={c.id}
              onMouseDown={() => handleSelect(c.nom)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
              className="cp-opt"
            >
              <span style={{ fontWeight: 600 }}>{c.nom}</span>
              {c.secteur && <span style={{ color: 'var(--tx3)', fontSize: 10.5 }}>{c.secteur}</span>}
            </div>
          ))}

          {showCreate && (
            <div
              onMouseDown={handleCreate}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                color: 'var(--G)', fontWeight: 700,
                borderTop: filtered.length > 0 ? '1px solid var(--bor)' : undefined,
              }}
              className="cp-opt"
            >
              {createClient.isPending ? 'Création…' : `+ Créer « ${query.trim()} »`}
            </div>
          )}
        </div>
      )}

      {(error || createErr) && (
        <span style={{ fontSize: 10.5, color: 'var(--R)', marginTop: 2, display: 'block' }}>
          {error || createErr}
        </span>
      )}
    </div>
  );
}
