'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { emptyData } from '@/lib/finance/engine';
import { addMonths, today } from '@/lib/finance/dates';
import { EntityForm } from './entity-form';
import { Modal } from './ui/dialog';
import { Button } from './ui/button';
const Context = createContext(null);
export const useFinance = () => useContext(Context);
async function command(payload) {
  const response = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
  return result;
}
export function FinanceProvider({ children }) {
  const [data, setData] = useState(emptyData),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [editor, setEditor] = useState(null),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState('');
  const started = useRef(false),
    version = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++version.current;
    const r = await fetch('/api/finance', { cache: 'no-store' });
    const value = await r.json();
    if (!r.ok) throw new Error(value.error);
    if (seq === version.current) {
      setData(value);
      setError('');
    }
  }, []);
  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      await command({ action: 'initialize' });
      await command({ action: 'generate', data: { through: addMonths(today(), 12) } });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      initialize();
    }
  }, [initialize]);
  useEffect(() => {
    const onFocus = () => refresh().catch((e) => setError(e.message));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  async function mutate(payload) {
    await command(payload);
    if (payload.entity === 'recurrences')
      await command({ action: 'generate', data: { through: addMonths(today(), 12) } });
    await refresh();
    setToast('Dados atualizados com sucesso.');
  }
  function open(entity, record, initial) {
    setEditor({ entity, record, initial });
  }
  function destructive(action, entity, id, label) {
    setConfirm({ action, entity, id, label });
  }
  return (
    <Context.Provider
      value={{ data, loading, error, refresh: initialize, open, mutate, destructive }}
    >
      {children}
      {editor && (
        <EntityForm
          key={`${editor.entity}-${editor.record?.id || 'new'}`}
          editor={editor}
          data={data}
          onClose={() => setEditor(null)}
          onSave={mutate}
        />
      )}
      {confirm && (
        <Modal
          open
          onOpenChange={(v) => !v && !busy && setConfirm(null)}
          title={
            confirm.action === 'delete'
              ? 'Excluir registro?'
              : confirm.action === 'reverse'
                ? 'Estornar operação?'
                : 'Cancelar lançamento?'
          }
          description={confirm.label}
        >
          <p>Essa operação recalcula saldos, relatórios e projeções. Confirme para continuar.</p>
          <div className="form-footer">
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
              Voltar
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate({ ...confirm, data: {} });
                  setConfirm(null);
                } catch (e) {
                  setToast(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Processando…' : 'Confirmar'}
            </Button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
