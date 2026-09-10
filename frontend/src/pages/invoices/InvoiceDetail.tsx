import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, updateInvoice, deleteInvoice, downloadPdf, regeneratePdf, sendInvoice, markAsPaid, sendReceipt } from '../../api/invoices';
import { getBusinessProfile } from '../../api/businessProfile';
import { formatDate } from '../../utils/dates';
import { confirm } from '../../services/dialog';
import type { Invoice, BusinessProfile, PaymentEntry } from '../../types';
import { DateTime } from 'luxon';
import PaymentDialog from './dialogs/PaymentDialog';
import ContactPickerDialog from '../../components/ContactPickerDialog';
import ActionsMenu, { type ActionMenuItem } from '../../components/ActionsMenu';
import ScaleToFit from '../../components/ScaleToFit';
import HelpButton from '../../components/HelpButton';
import InvoiceHeader from '../../components/InvoiceHeader';
import { invoiceContactsHelp } from '../../content/helpCopy';
import { visibleInvoiceRows } from '../../utils/invoiceLineItems';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
};


export default function InvoiceDetail() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<PaymentEntry | null>()
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [sendDialogAction, setSendDialogAction] = useState<'invoice' | 'receipt' | null>(null);

  useEffect(() => {
    Promise.all([getInvoice(id), getBusinessProfile()])
      .then(([inv, biz]) => { setInvoice(inv); setBusiness(biz); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleContactChange(contactId: string) {
    if (!invoice || !contactId) { setEditingContact(false); return; }
    setSavingContact(true);
    try {
      const updated = await updateInvoice(invoice.id, { contact_id: Number(contactId) });
      if (updated) setInvoice(updated);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingContact(false);
      setEditingContact(false);
    }
  }

  async function sendToContact(action: 'invoice' | 'receipt', contactId?: number) {
    setSending(true);
    try {
      const res = action === 'invoice' ? await sendInvoice(id, contactId) : await sendReceipt(id, contactId);
      if (res) alert(res.message);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function startSend(action: 'invoice' | 'receipt') {
    if (!invoice) return;

    // Only one contact to choose from — nothing to pick, so skip the picker and go straight to
    // the usual confirmation instead of showing a dialog with no real choice in it.
    if (contacts.length <= 1) {
      const contact = contacts[0] ?? invoice.contact;
      const label = action === 'invoice' ? 'Send Invoice' : 'Send Receipt';
      const verb = action === 'invoice' ? 'Send invoice to' : 'Send paid receipt to';
      if (!await confirm(`${verb} ${contact?.email || contact?.name}?`, { title: label, confirmLabel: 'Send', danger: false })) return;
      await sendToContact(action);
      return;
    }

    setSendDialogAction(action);
  }

  const handleSendInvoice = () => startSend('invoice');
  const handleSendReceipt = () => startSend('receipt');

  async function handleDownloadPdf() {
    if (!invoice) return;
    try {
      await downloadPdf(id, `${invoice.number}.pdf`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleRegeneratePdf() {
    if (!invoice) return;
    if (!await confirm('Regenerate the PDF? This will overwrite the existing file.', { title: 'Regenerate PDF', confirmLabel: 'Regenerate', danger: false })) return;
    setRegenerating(true);
    try {
      await regeneratePdf(id);
      await downloadPdf(id, `${invoice.number}.pdf`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!await confirm('Delete this invoice? This cannot be undone.', { title: 'Delete Invoice', confirmLabel: 'Delete' })) return;
    try {
      await deleteInvoice(id);
      navigate('/invoices');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function openPaymentDialog() {
    if (!invoice) {
      return
    }
    const paymentEntry: PaymentEntry = {
      invoice: invoice,
      paid_at: DateTime.local().toISODate(),
      amount_paid: invoice.total ?? 0
    }
    setPaymentEntry(paymentEntry)
    setShowPaymentDialog(true)
  }

  async function handleMarkAsPaid(payment: PaymentEntry) {
    try {
      const updated = await markAsPaid(id, payment.amount_paid, payment.paid_at ?? undefined);
      setInvoice(updated);
      setPaymentEntry(null)
      setShowPaymentDialog(false);
    } catch (e) {
      alert((e as Error).message);
    }
  }


  async function handleMarkAsSent() {
    if (!invoice) return;
    try {
      const updated = await updateInvoice(id, { status: 'sent' });
      if (updated) setInvoice(updated);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!invoice) return null;

  const contacts = invoice.client?.contacts ?? [];
  const brand = business?.primary_color || '#4338ca';

  const periodSubtitle = invoice.start_date && invoice.end_date
    ? `Period: ${formatDate(invoice.start_date)} – ${formatDate(invoice.end_date)}`
    : null;

  const paymentTerms = invoice.client?.sales_terms || business?.default_payment_terms || 'NET 15';
  const footer = business?.invoice_footer || 'Thank you for your business.';
  const invoiceRows = visibleInvoiceRows(invoice.invoice_line_items || []);

  // Same actions, same conditions as the button row below — this is what collapses into a
  // single menu on narrower screens instead of an overflowing row of up to 6 buttons.
  const actionItems: ActionMenuItem[] = [
    ...(invoice.status === 'pending' ? [{ label: 'Mark as Sent', onClick: handleMarkAsSent, variant: 'primary' as const }] : []),
    { label: sending ? 'Sending…' : 'Send Invoice', onClick: handleSendInvoice, disabled: sending, variant: 'primary' },
    { label: 'Download PDF', onClick: handleDownloadPdf },
    ...(invoice.status !== 'paid' ? [{ label: 'Mark As Paid', onClick: openPaymentDialog }] : []),
    ...(invoice.status === 'paid' ? [{ label: sending ? 'Sending…' : 'Send Receipt', onClick: handleSendReceipt, disabled: sending, variant: 'primary' as const }] : []),
    { label: regenerating ? 'Regenerating…' : 'Regenerate PDF', onClick: handleRegeneratePdf, disabled: regenerating },
    ...(invoice.status !== 'paid' ? [{ label: 'Delete', onClick: handleDelete, variant: 'danger' as const }] : []),
  ];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">
            ← Invoices
          </button>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[invoice.status]}`}>
            {invoice.status}
          </span>
          <HelpButton title={invoiceContactsHelp.title}>{invoiceContactsHelp.content}</HelpButton>
        </div>
        <div className="md:hidden">
          <ActionsMenu items={actionItems} />
        </div>
        <div className="hidden md:flex items-center gap-3">
          {invoice.status === 'pending' && (
            <button
              onClick={handleMarkAsSent}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Mark as Sent
            </button>
          )}
          <button
            onClick={handleSendInvoice}
            disabled={sending}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending…' : 'Send Invoice'}
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Download PDF
          </button>
          {invoice.status !== 'paid' && (
            <button
              onClick={openPaymentDialog}
              className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Mark As Paid
            </button>
          )}
          {invoice.status === 'paid' && (
            <button
              onClick={handleSendReceipt}
              disabled={sending}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending…' : 'Send Receipt'}
            </button>
          )}
          <button
            onClick={handleRegeneratePdf}
            disabled={regenerating}
            className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Regenerating…' : 'Regenerate PDF'}
          </button>
          {invoice.status !== 'paid' && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-200 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ScaleToFit width={896}>
      <div className="bg-white rounded-lg shadow p-6 flex flex-col relative overflow-hidden" style={{ minHeight: '1050px' }}>
        {invoice.status === 'paid' && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(-35deg)',
            fontSize: '96px', fontWeight: 900, letterSpacing: '0.1em',
            color: 'rgba(34,197,94,0.2)', pointerEvents: 'none', zIndex: 10,
            userSelect: 'none',
          }}>
            PAID
          </div>
        )}
        <InvoiceHeader
          business={business}
          client={invoice.client}
          contact={invoice.contact}
          number={invoice.number}
          createdAt={invoice.created_at!}
          periodSubtitle={periodSubtitle}
          contacts={contacts}
          editingContact={editingContact}
          savingContact={savingContact}
          onStartEditContact={() => setEditingContact(true)}
          onContactChange={handleContactChange}
          onCancelEditContact={() => setEditingContact(false)}
        />

        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: brand }}>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">Project</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">Description</th>
              {invoiceRows.showHours && <>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide">Hours</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide">Rate</th>
              </>}
              <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoiceRows.rows.map((row, i) => (
              <tr key={row.id} style={i % 2 === 1 ? { backgroundColor: '#f9fafb' } : {}}>
                {row.isTextOnly ? (
                  <td
                    colSpan={invoiceRows.showHours ? 6 : 4}
                    className="px-3 py-2 text-sm font-semibold text-gray-900 border-b border-gray-200"
                  >
                    {row.description}
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-sm text-gray-600 border-b border-gray-200">
                      {row.date ? formatDate(row.date) : '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 border-b border-gray-200">{row.projectName}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 border-b border-gray-200">{row.description}</td>
                    {invoiceRows.showHours && <>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right border-b border-gray-200">
                        {row.hours != null ? row.hours.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right border-b border-gray-200">
                        {row.rate != null ? `$${row.rate.toFixed(2)}` : '—'}
                      </td>
                    </>}
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right border-b border-gray-200">
                      ${(row.amount ?? 0).toFixed(2)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {(() => {
          const items = invoice.invoice_line_items || [];
          // A text-only custom line has amount: null (nothing to bill) — guard against it, same
          // as Invoice#recalculate_total! does on the backend.
          const subtotal = items.reduce((s, i) => s + (i.amount ?? 0), 0);
          const taxAmount = items.reduce((s, i) => s + (i.amount ?? 0) * parseFloat(i.tax_rate || '0') / 100, 0);
          const taxRate = items.find((i) => parseFloat(i.tax_rate || '0') > 0)?.tax_rate;
          return (
            <div className="mt-auto flex justify-end pt-4">
              <div className="text-right space-y-1">
                {taxAmount > 0 && <>
                  <div className="flex justify-between gap-16">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Subtotal</span>
                    <span className="text-sm text-gray-700">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-16">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">
                      HST ({parseFloat(taxRate!).toFixed(0)}%){business?.hst_number ? ` · Reg# ${business.hst_number}` : ''}
                    </span>
                    <span className="text-sm text-gray-700">${taxAmount.toFixed(2)}</span>
                  </div>
                </>}
                <div className="flex justify-between gap-16 pt-1 border-t border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Total</span>
                  <span className="text-2xl font-bold text-gray-900">${(invoice.total || 0).toFixed(2)}</span>
                </div>
                {invoice.status === 'paid' && <>
                  <div className="flex justify-between gap-16 pt-1 border-t border-gray-200">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Amount Paid</span>
                    <span className="text-sm text-green-600 font-medium">${(invoice.amount_paid || 0).toFixed(2)}</span>
                  </div>
                  {invoice.paid_at && (
                    <div className="flex justify-between gap-16">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Payment Date</span>
                      <span className="text-sm text-gray-700">{formatDate(invoice.paid_at)}</span>
                    </div>
                  )}
                </>}
              </div>
            </div>
          );
        })()}

        <div className="mt-10 pt-3 border-t border-gray-200 text-xs text-gray-400 leading-relaxed">
          Payment terms: <strong className="text-gray-500">{paymentTerms}</strong>
          <br />
          {footer}
        </div>
      </div>
      </ScaleToFit>
      {showPaymentDialog && (
        <PaymentDialog
          payment={paymentEntry!}
          onSubmit={handleMarkAsPaid}
          onCancel={() => setShowPaymentDialog(false)}
        />
      )}

      {sendDialogAction && (
        <ContactPickerDialog
          title={sendDialogAction === 'invoice' ? `Send invoice ${invoice.number} to…` : `Send receipt for ${invoice.number} to…`}
          contacts={contacts}
          defaultContactId={invoice.contact?.id}
          onSubmit={(contactId) => { const action = sendDialogAction; setSendDialogAction(null); sendToContact(action, contactId); }}
          onCancel={() => setSendDialogAction(null)}
        />
      )}
    </div>
  );
}
