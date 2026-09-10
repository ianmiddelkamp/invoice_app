import { formatDate } from '../utils/dates';
import type { BusinessProfile, Client, Contact } from '../types';

interface Props {
  business: BusinessProfile | null;
  client: Client | null | undefined;
  contact: Contact | null | undefined;
  number: string;
  createdAt: string;
  periodSubtitle?: string | null;
  // Contact editing is optional — InvoiceDetail supports changing "Bill To" inline; a
  // newly-created custom invoice can just show it read-only until that's needed there too.
  contacts?: Contact[];
  editingContact?: boolean;
  savingContact?: boolean;
  onStartEditContact?: () => void;
  onContactChange?: (contactId: string) => void;
  onCancelEditContact?: () => void;
}

// The "document" header shared by every invoice-shaped page — logo/title, invoice number and
// date, and the From/Bill To grid. Extracted from InvoiceDetail.tsx so the custom invoice
// creator shows the exact same header a generated invoice does, rather than a plain page title.
export default function InvoiceHeader({
  business, client, contact, number, createdAt, periodSubtitle,
  contacts = [], editingContact = false, savingContact = false,
  onStartEditContact, onContactChange, onCancelEditContact,
}: Props) {
  const brand = business?.primary_color || '#4338ca';
  const bizAddress = [business?.address1, business?.city, business?.state, business?.postcode].filter(Boolean).join(', ');
  const clientAddress = [client?.address1, client?.city, client?.state, client?.postcode].filter(Boolean).join(', ');

  return (
    <>
      <div className="flex justify-between items-start">
        <div>
          {business?.logo_data_uri ? (
            <img src={business.logo_data_uri} alt={business.name} className="max-h-20 max-w-40 object-contain" />
          ) : (
            <div style={{ color: brand }} className="text-4xl font-bold tracking-tight leading-none">INVOICE</div>
          )}
        </div>
        <div className="text-right">
          {business?.logo_data_uri && (
            <div style={{ color: brand }} className="text-2xl font-bold tracking-tight leading-none">INVOICE</div>
          )}
          <div className="text-sm font-semibold text-gray-900 mt-1">{number}</div>
          <div className="text-xs text-gray-500 mt-1">Date: {formatDate(createdAt)}</div>
          {periodSubtitle && <div className="text-xs text-gray-500 mt-0.5">{periodSubtitle}</div>}
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${brand}`, margin: '16px 0' }} />

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">From</p>
          <p className="text-sm font-semibold text-gray-900">{business?.name || 'Your Business'}</p>
          <div className="text-xs text-gray-500 leading-relaxed mt-1">
            {bizAddress && <div>{bizAddress}</div>}
            {business?.email && <div>{business.email}</div>}
            {business?.phone && <div>{business.phone}</div>}
            {business?.hst_number && <div>HST # {business.hst_number}</div>}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Bill To</p>
          <p className="text-sm font-semibold text-gray-900">{client?.name}</p>
          <div className="text-xs text-gray-500 leading-relaxed mt-1">
            {editingContact ? (
              <select
                autoFocus
                defaultValue={contact?.id}
                disabled={savingContact}
                onChange={(e) => onContactChange?.(e.target.value)}
                onBlur={() => onCancelEditContact?.()}
                className="text-xs border-b border-indigo-400 outline-none bg-transparent text-gray-700"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              contact?.name && (
                <div className="flex items-center gap-1.5">
                  <span>{contact.name}</span>
                  {onStartEditContact && (
                    <button
                      type="button"
                      onClick={onStartEditContact}
                      title="Change who this invoice is billed to"
                      className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )
            )}
            {contact?.email && <div>{contact.email}</div>}
            {contact?.phone && <div>{contact.phone}</div>}
            {clientAddress && <div>{clientAddress}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
