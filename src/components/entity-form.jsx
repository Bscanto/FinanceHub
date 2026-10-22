'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from './ui/dialog';
import { Button } from './ui/button';
import { DEFINITIONS, defaultsFor } from '@/lib/finance/forms';
import { schemas } from '@/lib/finance/schemas';
import { cents, moneyInput } from '@/lib/finance/money';
export function EntityForm({ editor, data, onClose, onSave }) {
  const { entity, record, initial = {} } = editor,
    def = DEFINITIONS[entity];
  const source = { ...defaultsFor(entity), ...def.defaults, ...record, ...initial };
  const values = Object.fromEntries([
    ...def.fields.map((f) => [
      f.key,
      f.type === 'money' || f.type === 'percent'
        ? moneyInput(source[f.key] || 0)
        : f.type === 'month'
          ? source[f.key]?.slice(0, 7)
          : (source[f.key] ?? ''),
    ]),
    ...(def.hidden || []).map((k) => [k, source[k] ?? null]),
  ]);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: values });
  const [requestId] = useState(() => crypto.randomUUID());
  const kind = watch('kind'),
    scope = watch('scope');
  function options(field) {
    if (Array.isArray(field.options)) return field.options;
    let rows = data[field.options === 'parent_categories' ? 'categories' : field.options] || [];
    if (field.options === 'categories')
      rows = rows.filter(
        (c) =>
          c.kind === (entity === 'transactions' || entity === 'recurrences' ? kind : 'expense'),
      );
    if (field.options === 'parent_categories')
      rows = rows.filter(
        (c) => !c.parent_id && c.id !== record?.id && c.kind === kind && c.scope === scope,
      );
    return rows.map((r) => [r.id, r.name || r.description]);
  }
  async function submit(raw) {
    try {
      const parsed = { ...raw };
      for (const f of def.fields) {
        if (f.type === 'money' || f.type === 'percent') parsed[f.key] = cents(raw[f.key]);
        else if (f.type === 'number') parsed[f.key] = Number(raw[f.key]);
        else if (f.type.startsWith('optional')) parsed[f.key] = raw[f.key] || null;
        else if (f.type === 'month') parsed[f.key] = raw[f.key] + '-01';
      }
      const valid = schemas[entity].safeParse(parsed);
      if (!valid.success) {
        valid.error.issues.forEach((i) => setError(i.path[0] || 'root', { message: i.message }));
        return;
      }
      await onSave({
        action: def.action || (record ? 'update' : 'create'),
        entity: def.action ? '' : entity,
        id: record?.id || requestId,
        data: valid.data,
      });
      onClose();
    } catch (e) {
      setError('root', { message: e.message });
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !isSubmitting && onClose()}
      title={`${record ? 'Editar' : 'Novo registro ·'} ${def.title}`}
      description={
        entity === 'transactions'
          ? 'Cadastre a previsão e depois registre o recebimento ou pagamento, inclusive parcial.'
          : entity === 'scenarios'
            ? 'Simulações não alteram seus lançamentos reais. Ajustes negativos reduzem a base.'
            : undefined
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="form-grid">
        {def.fields.map((f) => (
          <label
            key={f.key}
            className={f.type === 'textarea' || f.type === 'checkbox' ? 'field wide' : 'field'}
          >
            <span>{f.label}</span>
            {f.type.includes('select') ? (
              <select {...register(f.key)} aria-invalid={!!errors[f.key]}>
                <option value="">{f.type === 'optional-select' ? 'Nenhum' : 'Selecione…'}</option>
                {options(f).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea {...register(f.key)} rows={3} />
            ) : (
              <input
                {...register(f.key)}
                type={
                  f.type === 'checkbox'
                    ? 'checkbox'
                    : f.type === 'date' || f.type === 'optional-date'
                      ? 'date'
                      : f.type === 'month'
                        ? 'month'
                        : f.type === 'number'
                          ? 'number'
                          : 'text'
                }
                inputMode={['money', 'percent'].includes(f.type) ? 'decimal' : undefined}
                aria-invalid={!!errors[f.key]}
                placeholder={f.type === 'money' ? '0,00' : undefined}
              />
            )}
            {errors[f.key] && <small className="error-text">{errors[f.key].message}</small>}
          </label>
        ))}
        {errors.root && (
          <p className="error-text wide" role="alert">
            {errors.root.message}
          </p>
        )}
        {entity === 'pay' && (
          <p className="form-hint wide">
            O valor pode ser parcial. O saldo pendente será recalculado após a confirmação.
          </p>
        )}
        {entity === 'purchase' && (
          <p className="form-hint wide">
            Compras no dia do fechamento entram na próxima fatura. Centavos restantes são
            distribuídos nas primeiras parcelas.
          </p>
        )}
        {entity === 'goals' && (
          <p className="form-hint wide">
            O valor reservado acompanha seu objetivo; não cria movimentação de caixa nem aumenta seu
            patrimônio.
          </p>
        )}
        <div className="form-footer wide">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar registro'}</Button>
        </div>
      </form>
    </Modal>
  );
}
