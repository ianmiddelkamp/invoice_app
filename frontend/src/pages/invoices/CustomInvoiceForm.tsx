import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getProject } from '../../api/projects';
import { getProjectRate, getClientRate } from '../../api/rates';
import { getBusinessProfile } from '../../api/businessProfile';
import { useInvoiceLineItems } from '../../hooks/useInvoiceLineItems';
import PageHeader from '../../components/PageHeader';
import InvoiceHeader from '../../components/InvoiceHeader';
import HelpButton from '../../components/HelpButton';
import ScaleToFit from '../../components/ScaleToFit';
import { confirm } from '../../services/dialog';
import { customInvoiceHelp } from '../../content/helpCopy';
import type { Project, BusinessProfile } from '../../types';

// Nothing is saved to the backend until "Create Invoice" is clicked — every add/edit/remove/
// attach/detach below is pure local state until then (see useInvoiceLineItems' draft mode).
export default function CustomInvoiceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(searchParams.get('project_id'));

  const [project, setProject] = useState<Project | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [defaultRate, setDefaultRate] = useState<number | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const {
    rows, total, attachedEntries, error: lineItemsError,
    showAttachPanel, unbilledEntries, selectedEntryIds, selectedHoursSum,
    addRow, updateDraft, saveRow, deleteRow,
    openAttachPanel, closeAttachPanel, toggleEntry, attach, detach, commit,
  } = useInvoiceLineItems(null);

  const error = pageError || lineItemsError;

  useEffect(() => {
    if (!projectId) {
      setPageError('No project specified.');
      setLoading(false);
      return;
    }
    Promise.all([getProject(projectId), getBusinessProfile()])
      .then(async ([p, biz]) => {
        if (!p) return;
        setProject(p);
        setBusiness(biz ?? null);

        // Rate defaults to the project's own rate, falling back to the client's default rate —
        // same resolution order used everywhere else in the app (see projectRateHelp).
        const projectRate = await getProjectRate(p.id).catch(() => null);
        if (projectRate?.rate != null) {
          setDefaultRate(projectRate.rate);
        } else {
          const clientRate = await getClientRate(p.client_id).catch(() => null);
          if (clientRate?.rate != null) setDefaultRate(clientRate.rate);
        }
      })
      .catch((e) => setPageError((e as Error).message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleCreateInvoice() {
    if (!project || creating) return;
    if (rows.length === 0) {
      if (!await confirm('This invoice has no line items yet. Create it anyway?')) return;
    }
    setCreating(true);
    try {
      const contact = project.client?.contacts?.find((c) => c.primary) || project.client?.contacts?.[0];
      const invoice = await commit({ clientId: project.client_id, contactId: contact?.id, projectId: project.id });
      if (invoice) navigate(`/invoices/${invoice.id}`);
    } catch (e) {
      setPageError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const primaryContact = project?.client?.contacts?.find((c) => c.primary) || project?.client?.contacts?.[0];

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="Custom Invoice"
        help={<HelpButton title={customInvoiceHelp.title}>{customInvoiceHelp.content}</HelpButton>}
      />

      <p className="text-sm text-gray-500 mb-4">
        Nothing is saved until you click <strong>Create Invoice</strong> below.
      </p>

      <ScaleToFit width={896}>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col" style={{ minHeight: '600px' }}>
          <InvoiceHeader
            business={business}
            client={project?.client}
            contact={primaryContact}
            number="Draft — not yet created"
            createdAt={new Date().toISOString()}
          />

          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: business?.primary_color || '#4338ca' }}>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide w-24">Hours</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide w-24">Rate</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wide w-28">Amount</th>
                <th className="w-40"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    <input
                      value={row.description}
                      onChange={(e) => updateDraft(row.id, { description: e.target.value })}
                      onBlur={() => saveRow(row.id)}
                      placeholder="Description (leave amount blank for a plain text row)"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    {row.kind === 'time' && (
                      <span className="text-xs text-gray-400">Backed by a logged time entry</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" step="0.01" value={row.hours}
                      onChange={(e) => updateDraft(row.id, { hours: e.target.value })}
                      onBlur={() => saveRow(row.id)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" step="0.01" value={row.rate}
                      onChange={(e) => updateDraft(row.id, { rate: e.target.value })}
                      onFocus={() => { if (row.rate === '' && defaultRate != null) updateDraft(row.id, { rate: String(defaultRate) }); }}
                      onBlur={() => saveRow(row.id)}
                      placeholder={defaultRate != null ? defaultRate.toFixed(2) : undefined}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" step="0.01" value={row.amount}
                      onChange={(e) => updateDraft(row.id, { amount: e.target.value })}
                      onBlur={() => saveRow(row.id)}
                      placeholder="—"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => project && openAttachPanel(row.id, project.client_id, project.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 mr-2"
                    >
                      Attach time
                    </button>
                    <button type="button" onClick={() => deleteRow(row.id)} className="text-xs text-red-600 hover:text-red-800">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => addRow(projectId)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-2 self-start"
          >
            + Add Row
          </button>

          <div className="flex justify-end pt-4 mt-auto border-t border-gray-200">
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest mr-4">Total</span>
              <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </ScaleToFit>

      {attachedEntries.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Time Entries Attached to This Invoice</h3>
          <div className="space-y-1">
            {attachedEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                <span>{entry.date} · {entry.hours.toFixed(2)}h · {entry.description || entry.task?.title || '—'}</span>
                <button
                  type="button"
                  onClick={() => detach(entry.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={creating}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create Invoice'}
        </button>
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
          Cancel
        </button>
      </div>

      {showAttachPanel != null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeAttachPanel}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Attach Unbilled Time Entries</h3>
            {unbilledEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No unbilled time entries for this project.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto border border-gray-200 rounded-md p-2 mb-4">
                {unbilledEntries.map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.has(entry.id)}
                      onChange={() => toggleEntry(entry.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {entry.date} · {entry.hours.toFixed(2)}h · {entry.description || entry.task?.title || '—'}
                  </label>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-1">Selected hours: <strong>{selectedHoursSum.toFixed(2)}</strong></p>
            {selectedEntryIds.size === 1 && (
              <p className="text-xs text-indigo-600 mb-4">
                Exactly one entry selected — this row will become a real time-based line backed by that entry once the invoice is created.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeAttachPanel} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => showAttachPanel != null && attach(showAttachPanel, defaultRate ?? undefined)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
              >
                Attach & Calculate Hours
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
