import { useEffect, useRef, useState } from 'react';
import {
  getInvoice, getUnbilledEntries, getInvoiceTimeEntries,
  createCustomInvoice, createLineItem, updateLineItem, deleteLineItem,
  attachTimeEntries, detachTimeEntries,
} from '../api/invoices';
import type { Invoice, TimeEntry, InvoiceLineItemDetail } from '../types';

// A row being edited — mirrors InvoiceLineItemDetail but with string form values, the same
// pattern ProjectForm/InvoiceForm use for number inputs (empty string vs. 0 need to stay
// distinguishable while typing). Before the invoice is created, `id` is a client-side negative
// temp id (never collides with a real one) and `pendingEntries` holds time entries selected for
// this row that only get attached for real once the invoice is actually created.
export interface RowDraft {
  id: number;
  kind: string;
  description: string;
  hours: string;
  rate: string;
  amount: string;
  saving: boolean;
  pendingEntries: TimeEntry[];
}

function toDraft(item: InvoiceLineItemDetail): RowDraft {
  return {
    id: item.id,
    kind: item.kind,
    description: item.description || '',
    hours: item.hours != null ? String(item.hours) : '',
    rate: item.rate != null ? String(item.rate) : '',
    amount: item.amount != null ? String(item.amount) : '',
    saving: false,
    pendingEntries: [],
  };
}

function sumHours(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.hours || 0), 0);
}

// Mirrors TimeEntry#billing_description on the backend exactly — used for the single-pending-
// entry draft preview so it matches, word for word, what attach_time_entries will actually save
// once the invoice is committed (that real save happens server-side and can't run early, since
// there's no line item to convert yet in draft mode).
function billingDescription(entry: TimeEntry): string {
  if (entry.charge_code) {
    return [entry.charge_code.code, entry.description || undefined].filter(Boolean).join(' · ');
  }
  return [entry.task?.task_group?.title, entry.task?.title, entry.description || undefined].filter(Boolean).join(' · ');
}

// A reasonable default description for a row backed by several time entries at once — there's
// no single "Group · Task · description" the backend could produce for a blend of entries either,
// so this stays a generic summary rather than trying to mimic billing_description.
function describeEntries(entries: TimeEntry[]): string {
  if (entries.length === 1) return billingDescription(entries[0]);
  const titles = [...new Set(entries.map((e) => e.task?.title).filter((t): t is string => Boolean(t)))];
  if (titles.length === 1) return titles[0];
  if (titles.length > 1) return `${entries.length} time entries (${titles.length} tasks)`;
  return `${entries.length} time entries`;
}

// Everything needed to add/edit/remove a line item on an invoice, and to attach/detach time
// entries against it. Two modes, chosen entirely by whether `invoiceId` is set:
//
// - invoiceId is null: nothing exists on the backend yet. Every add/edit/remove/attach/detach is
//   pure local state — the custom invoice creator uses this so a user can freely build up a
//   whole invoice and back out of it without ever touching the database. Call `commit()` once
//   they click "Create Invoice" to actually persist everything (the invoice, every line item,
//   and every pending attachment) in one go.
// - invoiceId is set: rows are loaded from and synced straight to that real invoice on every
//   change — meant for editing an already-generated invoice (not built yet, but this hook is
//   already shaped for it).
export function useInvoiceLineItems(invoiceId: number | null) {
  const isDraft = invoiceId == null;
  const nextTempId = useRef(-1);

  const [rows, setRows] = useState<RowDraft[]>([]);
  const [total, setTotal] = useState(0);
  const [backendAttachedEntries, setBackendAttachedEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showAttachPanel, setShowAttachPanel] = useState<number | null>(null); // row id
  const [unbilledEntries, setUnbilledEntries] = useState<TimeEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!invoiceId) return;
    getInvoice(invoiceId).then((invoice) => {
      if (!invoice) return;
      setTotal(invoice.total ?? 0);
      if (invoice.invoice_line_items) setRows(invoice.invoice_line_items.map(toDraft));
    }).catch((e) => setError((e as Error).message));

    // Loaded separately from the invoice itself — no need for every ordinary invoice fetch
    // elsewhere in the app to pay for this query.
    getInvoiceTimeEntries(invoiceId).then((entries) => { if (entries) setBackendAttachedEntries(entries); }).catch(() => {});
  }, [invoiceId]);

  // Draft-mode total/attached-entries are derived from local row state; once a real invoice
  // exists, they come from the backend instead (recalculate_total! already accounts for tax etc.
  // in ways not worth re-deriving client-side).
  const draftTotal = rows.reduce((sum, r) => sum + (r.amount === '' ? 0 : parseFloat(r.amount) || 0), 0);
  const draftAttachedEntries = rows.flatMap((r) => r.pendingEntries);

  const effectiveTotal = isDraft ? draftTotal : total;
  const attachedEntries = isDraft ? draftAttachedEntries : backendAttachedEntries;

  async function refreshTotal() {
    if (!invoiceId) return;
    const invoice = await getInvoice(invoiceId);
    if (invoice) setTotal(invoice.total ?? 0);
  }

  function addRow(projectId?: number | null) {
    if (isDraft) {
      const row: RowDraft = {
        id: nextTempId.current--, kind: 'custom', description: '', hours: '', rate: '', amount: '',
        saving: false, pendingEntries: [],
      };
      setRows((prev) => [...prev, row]);
      return;
    }
    createRowOnServer(projectId);
  }

  async function createRowOnServer(projectId?: number | null) {
    if (!invoiceId) return;
    const position = rows.length + 1;
    try {
      const created = await createLineItem(invoiceId, { description: '', project_id: projectId, position });
      if (!created) return;
      if (created.warnings?.length) alert(created.warnings.join('\n\n'));
      setRows((prev) => [...prev, toDraft(created)]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function updateDraft(id: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      // Amount is calculated automatically once both Hours and Rate are known — still a plain
      // field afterward, so the user can override it (e.g. a milestone amount unrelated to
      // hours × rate) by editing it directly.
      if (('hours' in patch || 'rate' in patch) && next.hours !== '' && next.rate !== '') {
        const computed = parseFloat(next.hours) * parseFloat(next.rate);
        if (!Number.isNaN(computed)) next.amount = String(computed);
      }
      return next;
    }));
  }

  async function saveRow(id: number) {
    if (isDraft) return; // already reflected in local state; nothing to persist yet
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    updateDraft(id, { saving: true });
    try {
      const updated = await updateLineItem(invoiceId!, id, {
        description: row.description,
        hours: row.hours === '' ? null : parseFloat(row.hours),
        rate: row.rate === '' ? null : parseFloat(row.rate),
        amount: row.amount === '' ? null : parseFloat(row.amount),
      });
      if (updated) {
        if (updated.warnings?.length) alert(updated.warnings.join('\n\n'));
        refreshTotal();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      updateDraft(id, { saving: false });
    }
  }

  async function deleteRow(id: number) {
    if (isDraft) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    try {
      await deleteLineItem(invoiceId!, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      refreshTotal();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openAttachPanel(rowId: number, clientId: number, projectId: number) {
    setShowAttachPanel(rowId);
    setSelectedEntryIds(new Set());
    try {
      const entries = await getUnbilledEntries(clientId);
      // Exclude entries already pending on some other row in this same draft — can't attach the
      // same entry to two rows at once.
      const alreadyPendingIds = new Set(rows.flatMap((r) => r.pendingEntries.map((e) => e.id)));
      if (entries) {
        setUnbilledEntries(entries.filter((e) => e.project_id === projectId && !alreadyPendingIds.has(e.id)));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function closeAttachPanel() {
    setShowAttachPanel(null);
  }

  function toggleEntry(id: number) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Checking entries live-sums their hours — a calculated value, not typed by hand, editable
  // afterward like any other field.
  const selectedHoursSum = [...selectedEntryIds].reduce((sum, id) => {
    const entry = unbilledEntries.find((e) => e.id === id);
    return sum + (entry?.hours || 0);
  }, 0);

  // fallbackRate is used only when the row doesn't already have its own rate typed in — the
  // project's default rate (resolved by the caller, same order as everywhere else: project rate
  // → client rate). Every attached entry comes from the same project (openAttachPanel already
  // filters to one), so one rate is always correct here, never a blend across different rates.
  async function attach(rowId: number, fallbackRate?: number) {
    if (selectedEntryIds.size === 0) {
      closeAttachPanel();
      return;
    }
    const selected = unbilledEntries.filter((e) => selectedEntryIds.has(e.id));

    if (isDraft) {
      // Purely local — nothing is actually marked billed until commit(). Hours, rate, and amount
      // are all calculated from the pending entries here — a single pending entry gets properly
      // converted into a real "time" kind line (with the entry's own rate/description) once
      // commit() actually persists it; until then this is just a preview using the same numbers.
      setRows((prev) => prev.map((r) => {
        if (r.id !== rowId) return r;
        const allEntries = [...r.pendingEntries, ...selected];
        const hours = sumHours(allEntries);
        const rate = r.rate !== '' ? parseFloat(r.rate) : fallbackRate;
        return {
          ...r,
          pendingEntries: allEntries,
          hours: String(hours),
          rate: rate != null ? String(rate) : r.rate,
          amount: rate != null ? String(hours * rate) : r.amount,
          description: r.description || describeEntries(allEntries),
        };
      }));
      closeAttachPanel();
      return;
    }

    try {
      // Exactly one entry has an unambiguous 1:1 mapping — the backend converts the row into a
      // real "time" kind line backed by that entry (its own date, task, rate) instead of a
      // hand-typed hours number. For more than one entry there's no such mapping, so hours, rate,
      // amount, and (if blank) description are all patched onto the row directly instead.
      const isSingleEntryConversion = selectedEntryIds.size === 1;
      await attachTimeEntries(invoiceId!, [...selectedEntryIds], isSingleEntryConversion ? rowId : undefined);
      if (!isSingleEntryConversion) {
        const row = rows.find((r) => r.id === rowId);
        const rate = row?.rate && row.rate !== '' ? parseFloat(row.rate) : fallbackRate;
        await updateLineItem(invoiceId!, rowId, {
          hours: selectedHoursSum,
          ...(rate != null ? { rate, amount: selectedHoursSum * rate } : {}),
          ...(!row?.description ? { description: describeEntries(selected) } : {}),
        });
      }
      const [invoice, entries] = await Promise.all([getInvoice(invoiceId!), getInvoiceTimeEntries(invoiceId!)]);
      if (invoice) {
        setTotal(invoice.total ?? 0);
        if (invoice.invoice_line_items) setRows(invoice.invoice_line_items.map(toDraft));
      }
      if (entries) setBackendAttachedEntries(entries);
    } catch (e) {
      setError((e as Error).message);
    }
    closeAttachPanel();
  }

  async function detach(entryId: number) {
    if (isDraft) {
      setRows((prev) => {
        const owner = prev.find((r) => r.pendingEntries.some((e) => e.id === entryId));
        if (!owner) return prev;

        // A row pending exactly one entry is the local preview of what would become a real
        // "time" kind line specifically tied to that one entry once committed — removing its
        // only entry removes the row too, matching exactly what detach_time_entries does
        // server-side for an already-created invoice (destroys any kind: "time" line whose
        // time_entry_id is the one being removed). A row summing several entries is left alone
        // otherwise, just recalculated.
        if (owner.pendingEntries.length === 1) {
          return prev.filter((r) => r.id !== owner.id);
        }

        return prev.map((r) => {
          if (r.id !== owner.id) return r;
          const remaining = r.pendingEntries.filter((e) => e.id !== entryId);
          const hours = sumHours(remaining);
          const rate = r.rate !== '' ? parseFloat(r.rate) : undefined;
          return {
            ...r,
            pendingEntries: remaining,
            hours: String(hours),
            amount: rate != null ? String(hours * rate) : r.amount,
          };
        });
      });
      return;
    }
    try {
      const result = await detachTimeEntries(invoiceId!, [entryId]);
      if (result) {
        setTotal(result.total ?? 0);
        if (result.invoice_line_items) setRows(result.invoice_line_items.map(toDraft));
        if (result.time_entries) setBackendAttachedEntries(result.time_entries);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Persists everything in one go: the invoice itself, then every row as a real line item, then
  // every row's pending time-entry attachments. Only ever called once, from "Create Invoice" —
  // nothing before this point has touched the database.
  async function commit(params: { clientId: number; contactId?: number; startDate?: string; endDate?: string; projectId?: number }): Promise<Invoice | null> {
    const invoice = await createCustomInvoice({
      client_id: params.clientId, contact_id: params.contactId,
      start_date: params.startDate, end_date: params.endDate,
    });
    if (!invoice) return null;

    for (const row of rows) {
      const created = await createLineItem(invoice.id, {
        description: row.description,
        hours: row.hours === '' ? null : parseFloat(row.hours),
        rate: row.rate === '' ? null : parseFloat(row.rate),
        amount: row.amount === '' ? null : parseFloat(row.amount),
        project_id: params.projectId,
      });
      if (!created) continue;
      if (created.warnings?.length) alert(created.warnings.join('\n\n'));

      if (row.pendingEntries.length > 0) {
        const entryIds = row.pendingEntries.map((e) => e.id);
        await attachTimeEntries(invoice.id, entryIds, entryIds.length === 1 ? created.id : undefined);
      }
    }

    return invoice;
  }

  return {
    rows, total: effectiveTotal, attachedEntries, error, isDraft,
    showAttachPanel, unbilledEntries, selectedEntryIds, selectedHoursSum,
    addRow, updateDraft, saveRow, deleteRow,
    openAttachPanel, closeAttachPanel, toggleEntry, attach, detach, commit,
  };
}
