import { apiFetch, getToken } from './index';
import type { Invoice, InvoiceLineItemDetail, TimeEntry } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Listing & fetching ────────────────────────────────────────────────────────

export const getInvoices = () =>
  apiFetch<Invoice[]>('/invoices');

export const getInvoice = (id: number) =>
  apiFetch<Invoice>(`/invoices/${id}`);

export const getUnbilledEntries = (clientId: number, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams({ client_id: String(clientId) });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  return apiFetch<TimeEntry[]>(`/invoices/unbilled_entries?${params}`);
};

// ── Creating & updating ───────────────────────────────────────────────────────

export const createInvoice = (data: unknown) =>
  apiFetch<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) });

// A custom invoice starts blank — no time entries, no InvoiceGenerator run — and is populated
// afterward via createLineItem/updateLineItem/deleteLineItem below.
export const createCustomInvoice = (data: { client_id: number; contact_id?: number; start_date?: string; end_date?: string }) =>
  apiFetch<Invoice>('/invoices', { method: 'POST', body: JSON.stringify({ ...data, custom: true }) });

export interface LineItemInput {
  description: string;
  hours?: number | null;
  rate?: number | null;
  amount?: number | null;
  project_id?: number | null;
  position?: number;
}

export const createLineItem = (invoiceId: number, data: LineItemInput) =>
  apiFetch<InvoiceLineItemDetail & { warnings: string[] }>(`/invoices/${invoiceId}/line_items`, {
    method: 'POST',
    body: JSON.stringify({ invoice_line_item: data }),
  });

export const updateLineItem = (invoiceId: number, lineItemId: number, data: Partial<LineItemInput>) =>
  apiFetch<InvoiceLineItemDetail & { warnings: string[] }>(`/invoices/${invoiceId}/line_items/${lineItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ invoice_line_item: data }),
  });

export const deleteLineItem = (invoiceId: number, lineItemId: number) =>
  apiFetch(`/invoices/${invoiceId}/line_items/${lineItemId}`, { method: 'DELETE' });

// Every time entry currently attached to a given invoice — loaded separately from the invoice
// itself, since only the custom invoice creator ever needs it.
export const getInvoiceTimeEntries = (invoiceId: number) =>
  apiFetch<TimeEntry[]>(`/invoices/${invoiceId}/time_entries`);

// Marks the given time entries billed against this invoice — used to calculate a line item's
// hours from real logged work. Independent of any specific line, UNLESS lineItemId is given
// with exactly one entry: that unambiguous 1:1 case converts the target line into a real "time"
// kind line backed by that entry (its own date, task, rate) instead of a hand-typed hours number.
export const attachTimeEntries = (invoiceId: number, timeEntryIds: number[], lineItemId?: number) =>
  apiFetch<{ message: string }>(`/invoices/${invoiceId}/attach_time_entries`, {
    method: 'POST',
    body: JSON.stringify({ time_entry_ids: timeEntryIds, line_item_id: lineItemId }),
  });

// Unbills the given entries. If one was the sole entry behind a converted "time" kind line, that
// line is deleted along with it — returns the invoice's updated total/line items and the
// refreshed attached-entries list in one round trip.
export const detachTimeEntries = (invoiceId: number, timeEntryIds: number[]) =>
  apiFetch<Invoice & { time_entries: TimeEntry[] }>(`/invoices/${invoiceId}/detach_time_entries`, {
    method: 'POST',
    body: JSON.stringify({ time_entry_ids: timeEntryIds }),
  });

export const updateInvoice = (id: number, data: Partial<Invoice> & { contact_id?: number }) =>
  apiFetch<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ invoice: data }) });

export const deleteInvoice = (id: number) =>
  apiFetch(`/invoices/${id}`, { method: 'DELETE' });

// ── Payment ───────────────────────────────────────────────────────────────────

export const markAsPaid = (id: number, amountPaid: number, paidAt?: string) =>
  apiFetch<Invoice>(`/invoices/${id}/mark_as_paid`, {
    method: 'POST',
    body: JSON.stringify({ payment: { amount_paid: amountPaid, paid_at: paidAt } }),
  });

// ── PDF & sending ─────────────────────────────────────────────────────────────

export const sendInvoice = (id: number, contactId?: number) =>
  apiFetch<{ message: string }>(`/invoices/${id}/send_invoice`, {
    method: 'POST',
    body: JSON.stringify(contactId ? { contact_id: contactId } : {}),
  });

export const sendReceipt = (id: number, contactId?: number) =>
  apiFetch<{ message: string }>(`/invoices/${id}/send_receipt`, {
    method: 'POST',
    body: JSON.stringify(contactId ? { contact_id: contactId } : {}),
  });

export const regeneratePdf = (id: number) =>
  apiFetch(`/invoices/${id}/regenerate_pdf`, { method: 'POST' });

// Uses raw fetch because the response is a binary blob, not JSON.
export async function downloadPdf(id: number, filename?: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/invoices/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to download PDF');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${id}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}
