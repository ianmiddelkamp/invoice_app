import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getClients } from '../../api/clients';
import { getProjects } from '../../api/projects';
import { getUnbilledEntries, createInvoice } from '../../api/invoices';
import PageHeader from '../../components/PageHeader';
import { today, firstOfMonth, formatDate } from '../../utils/dates';
import type { Client, Project, TimeEntry } from '../../types';

interface LocationState {
  entries: TimeEntry[];
  clientId: string;
}

interface EntryGroup {
  label: string;
  entries: TimeEntry[];
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const preloaded = location.state as LocationState | null;

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<'time' | 'custom'>('time');
  const [customProjectId, setCustomProjectId] = useState('');
  const [form, setForm] = useState({
    client_id: preloaded?.clientId || '',
    start_date: firstOfMonth(),
    end_date: today(),
  });
  const [step, setStep] = useState<'setup' | 'select'>(preloaded?.entries ? 'select' : 'setup');
  const [entries, setEntries] = useState<TimeEntry[]>(preloaded?.entries || []);
  const [selected, setSelected] = useState<Set<number>>(new Set(preloaded?.entries?.map((e) => e.id) || []));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contactId, setContactId] = useState('');

  useEffect(() => {
    if (preloaded) {
      navigate(location.pathname, { replace: true, state: null });
    }
    getClients()
      .then((cs) => {
        if (!cs) return;
        setClients(cs);
        if (!preloaded && cs.length > 0) setForm((prev) => ({ ...prev, client_id: String(cs[0].id) }));
      })
      .catch((e) => setError((e as Error).message));
    getProjects().then((ps) => { if (ps) setProjects(ps); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'client_id') setCustomProjectId('');
  }

  async function handleLoadEntries(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await getUnbilledEntries(form.client_id, form.start_date, form.end_date);
      if (!data || data.length === 0) {
        setError('No unbilled time entries found for this client in the selected period.');
        return;
      }
      setEntries(data);
      setSelected(new Set(data.map((entry) => entry.id)));
      setStep('select');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleEntry(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(entries.map((e) => e.id))); }
  function deselectAll() { setSelected(new Set()); }

  async function handleGenerate() {
    if (selected.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const invoice = await createInvoice({
        client_id: form.client_id,
        contact_id: contactId || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        time_entry_ids: [...selected],
      });
      if (invoice) {
        if (invoice.warnings?.length) alert(invoice.warnings.join('\n\n'));
        navigate(`/invoices/${invoice.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleContinueCustom() {
    if (!customProjectId) return;
    navigate(`/invoices/custom/new?project_id=${customProjectId}`);
  }

  const selectedClient = clients.find((c) => String(c.id) === form.client_id);
  const clientName = selectedClient?.name;
  const contacts = selectedClient?.contacts ?? [];
  const clientProjects = projects.filter((p) => String(p.client_id) === form.client_id);

  useEffect(() => {
    const primary = contacts.find((c) => c.primary);
    setContactId(primary ? String(primary.id) : contacts[0] ? String(contacts[0].id) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.client_id, clients.length]);

  const groups = entries.reduce<Record<string, EntryGroup>>((acc, entry) => {
    const key = entry.project ? `project-${entry.project.id}` : `cc-${entry.charge_code?.id}`;
    const label = entry.project
      ? entry.project.name
      : `${entry.charge_code?.code}${entry.charge_code?.description ? ` — ${entry.charge_code.description}` : ''}`;
    if (!acc[key]) acc[key] = { label, entries: [] };
    acc[key].entries.push(entry);
    return acc;
  }, {});

  const selectedTotal = entries
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + e.hours, 0);

  if (step === 'select') {
    return (
      <div className="p-8 max-w-3xl">
        <PageHeader title="New Invoice" />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{clientName}</h2>
              <p className="text-sm text-gray-400">{form.start_date} → {form.end_date}</p>
            </div>
            <div className="flex items-center gap-4">
              {contacts.length > 0 && (
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.primary ? ' (Primary)' : ''}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-3 text-sm">
                <button onClick={selectAll} className="text-indigo-600 hover:text-indigo-800">Select all</button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAll} className="text-indigo-600 hover:text-indigo-800">Deselect all</button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {Object.values(groups).map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.entries.map((entry) => (
                    <label key={entry.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 w-24 shrink-0">{formatDate(entry.date)}</span>
                          <span className="text-sm font-medium text-gray-900">{entry.hours.toFixed(2)} hrs</span>
                          {entry.task && <span className="text-sm text-gray-400">{entry.task.title}</span>}
                        </div>
                        {entry.description && (
                          <p className="text-xs text-gray-400 mt-0.5 ml-[6.75rem] truncate">{entry.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{selected.size}</span> of {entries.length} entries selected
              {' · '}<span className="font-medium">{selectedTotal.toFixed(2)} hrs</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => preloaded ? navigate('/timesheets') : (setStep('setup'), setError(null))}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || selected.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {generating ? 'Generating…' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-lg">
      <PageHeader title="New Invoice" />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        <div className="flex rounded-md border border-gray-300 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setMode('time')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded ${mode === 'time' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Bill from Time Entries
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded ${mode === 'custom' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Custom Invoice
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <select
            name="client_id"
            value={form.client_id}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {mode === 'time' ? (
          <form onSubmit={handleLoadEntries} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !form.client_id}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading…' : 'Load Entries →'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
              <select
                value={customProjectId}
                onChange={(e) => setCustomProjectId(e.target.value)}
                disabled={!form.client_id}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
              >
                <option value="">{form.client_id ? 'Select a project…' : 'Select a client first'}</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleContinueCustom}
                disabled={!customProjectId}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Continue →
              </button>
              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
