import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInvoices, deleteInvoice } from '../../api/invoices';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable, { type TableColumn } from '../../components/ResponsiveTable';
import ExportMenu from '../../components/ExportMenu';
import { confirm } from '../../services/dialog';
import { formatDate } from '../../utils/dates';
import { downloadExport } from '../../utils/export';
import type { Invoice } from '../../types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
};

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoices()
      .then((data) => { if (data) setInvoices(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!await confirm('Delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const columns: TableColumn<Invoice>[] = [
    {
      key: 'number', label: 'Invoice #',
      render: (inv) => <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">{inv.number}</Link>,
    },
    { key: 'client', label: 'Client', render: (inv) => inv.client?.name || '—' },
    {
      key: 'period', label: 'Period',
      render: (inv) => inv.start_date && inv.end_date
        ? `${formatDate(inv.start_date)} – ${formatDate(inv.end_date)}`
        : formatDate(inv.start_date),
    },
    { key: 'total', label: 'Total', render: (inv) => `$${inv.total != null ? inv.total.toFixed(2) : '—'}` },
    {
      key: 'status', label: 'Status',
      render: (inv) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[inv.status] ?? ''}`}>
          {inv.status}
        </span>
      ),
    },
    { key: 'outstanding', label: 'Outstanding', render: (inv) => `$${inv.outstanding != null ? inv.outstanding.toFixed(2) : '—'}` },
    { key: 'paid_at', label: 'Payment Date', render: (inv) => inv.paid_at != null ? formatDate(inv.paid_at) : '—' },
  ];

  function runExport(format: string, extension: string) {
    downloadExport(`/invoices/export?format=${format}`, `invoices.${extension}`)
      .catch((e) => setError(e.message));
  }
  const exportOptions = [
    { label: 'CSV', onClick: () => runExport('csv', 'csv') },
    { label: 'Excel', onClick: () => runExport('xlsx', 'xlsx') },
    { label: 'Markdown', onClick: () => runExport('md', 'md') },
  ];

  return (
    <div className="p-4 sm:p-8">
      {/* /invoices/new offers both "bill from time entries" and "custom invoice" as a mode
          toggle, so this page only ever needs the one action. */}
      <PageHeader title="Invoices" actionLabel="+ New Invoice" actionTo="/invoices/new" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ExportMenu options={exportOptions} />
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <ResponsiveTable
          columns={columns}
          rows={invoices}
          keyExtractor={(inv) => inv.id}
          emptyMessage="No invoices yet."
          actions={(inv) => (
            <>
              <Link to={`/invoices/${inv.id}`} className="text-indigo-600 hover:text-indigo-800">View</Link>
              <button onClick={() => handleDelete(inv.id)} className="text-red-500 hover:text-red-700">Delete</button>
            </>
          )}
        />
      )}
    </div>
  );
}
