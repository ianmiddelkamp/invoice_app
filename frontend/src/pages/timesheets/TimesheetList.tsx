import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients } from '../../api/clients';
import { getProjects } from '../../api/projects';
import { getChargeCodes } from '../../api/chargeCodes';
import { getAllTimeEntries, deleteTimeEntry, deleteChargeCodeTimeEntry } from '../../api/timeEntries';
import PageHeader from '../../components/PageHeader';
import ExportMenu from '../../components/ExportMenu';
import HelpButton from '../../components/HelpButton';
import { timesheetsListHelp } from '../../content/helpCopy';
import { formatDateTime, formatDate } from '../../utils/dates';
import { downloadExport } from '../../utils/export';
import { confirm } from '../../services/dialog';
import type { Client, Project, ChargeCode, TimeEntry } from '../../types';

export default function TimesheetList() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargeCodeMenuOpen, setChargeCodeMenuOpen] = useState(false);
  const chargeCodeMenuRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState({
    clientId: '',
    projectId: '',
    status: 'all',
    chargeCodeIds: new Set<number>(),
  });

  const [sort, setSort] = useState({ column: 'date', direction: 'desc' });

  function toggleSort(column: string) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    );
  }

  function sortIndicator(column: string) {
    if (sort.column !== column) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>;
  }

  useEffect(() => {
    getClients().then((data) => { if (data) setClients(data); }).catch(() => {});
    getProjects().then((data) => { if (data) setProjects(data); }).catch(() => {});
    getChargeCodes().then((data) => { if (data) setChargeCodes(data); }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (chargeCodeMenuRef.current && !chargeCodeMenuRef.current.contains(e.target as Node)) {
        setChargeCodeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleProjects = filters.clientId
    ? projects.filter((p) => String(p.client?.id) === filters.clientId)
    : projects;

  const loadEntries = useCallback(() => {
    setLoading(true);
    setError(null);
    setSelected(new Set());

    const params: Record<string, string> = {};
    if (filters.clientId) params.client_id = filters.clientId;
    if (filters.projectId) params.project_id = filters.projectId;
    if (filters.status !== 'all') params.status = filters.status;
    if (!filters.projectId && filters.chargeCodeIds.size > 0) {
      params.charge_code_ids = [...filters.chargeCodeIds].join(',');
    }

    getAllTimeEntries(params)
      .then((data) => { if (data) setEntries(data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'clientId') next.projectId = '';
      if (key === 'projectId' && value) next.chargeCodeIds = new Set();
      return next;
    });
  }

  function toggleChargeCode(id: number) {
    setFilters((prev) => {
      const next = new Set(prev.chargeCodeIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, chargeCodeIds: next };
    });
  }

  function toggleAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const selectedTotalHours = selectedEntries.reduce((prev, curr) => prev + curr.hours, 0).toFixed(2);
  const allSelectedUnbilled = selectedEntries.length > 0 && selectedEntries.every((e) => !e.invoice);
  const selectedClientIds = new Set(
    selectedEntries.map((e) => e.project ? String(e.project.client_id) : String(e.client_id))
  );
  const canCreateInvoice = allSelectedUnbilled && selectedClientIds.size === 1;

  function handleCreateInvoice() {
    const clientId = [...selectedClientIds][0];
    navigate('/invoices/new', { state: { entries: selectedEntries, clientId } });
  }

  async function handleDelete(entry: TimeEntry) {
    if (!await confirm('Delete this time entry?')) return;
    try {
      if (entry.charge_code) {
        await deleteChargeCodeTimeEntry(entry.id);
      } else if (entry.project) {
        await deleteTimeEntry(entry.project.id, entry.id);
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setSelected((prev) => { const next = new Set(prev); next.delete(entry.id); return next; });
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function clientNameForEntry(entry: TimeEntry) {
    return entry.project?.client?.name || entry.client?.name || '—';
  }

  const sortableColumns = ['date', 'hours', 'client', 'project', 'task'];

  const sortedEntries = [...entries].sort((a, b) => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    switch (sort.column) {
      case 'date':    return dir * a.date.localeCompare(b.date);
      case 'hours':   return dir * (a.hours - b.hours);
      case 'client':  return dir * clientNameForEntry(a).localeCompare(clientNameForEntry(b));
      case 'project': return dir * (a.project?.name || a.charge_code?.code || '').localeCompare(b.project?.name || b.charge_code?.code || '');
      case 'task':    return dir * (a.task?.title || '').localeCompare(b.task?.title || '');
      default:        return 0;
    }
  });

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const allChecked = entries.length > 0 && selected.size === entries.length;
  const someChecked = selected.size > 0 && selected.size < entries.length;

  function exportParams(format: string) {
    const params: Record<string, string> = { format };
    if (filters.clientId) params.client_id = filters.clientId;
    if (filters.projectId) params.project_id = filters.projectId;
    if (filters.status !== 'all') params.status = filters.status;
    if (!filters.projectId && filters.chargeCodeIds.size > 0) {
      params.charge_code_ids = [...filters.chargeCodeIds].join(',');
    }
    return new URLSearchParams(params).toString();
  }
  function runExport(format: string, extension: string) {
    downloadExport(`/time_entries/export?${exportParams(format)}`, `timesheets.${extension}`)
      .catch((e) => setError(e.message));
  }
  const exportOptions = [
    { label: 'CSV', onClick: () => runExport('csv', 'csv') },
    { label: 'Excel', onClick: () => runExport('xlsx', 'xlsx') },
    { label: 'Markdown', onClick: () => runExport('md', 'md') },
  ];

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Timesheets"
        actionLabel="+ Log Time"
        actionTo="/timesheets/new"
        help={<HelpButton title={timesheetsListHelp.title}>{timesheetsListHelp.content}</HelpButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={filters.clientId}
          onChange={(e) => setFilter('clientId', e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
        >
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filters.projectId}
          onChange={(e) => setFilter('projectId', e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
        >
          <option value="">All Projects</option>
          {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
        >
          <option value="all">All</option>
          <option value="unbilled">Unbilled</option>
          <option value="billed">Invoiced</option>
        </select>

        {!filters.projectId && (
          <div className="relative" ref={chargeCodeMenuRef}>
            <button
              type="button"
              onClick={() => setChargeCodeMenuOpen((prev) => !prev)}
              className="rounded-md border border-gray-300 bg-white shadow-sm sm:text-sm px-3 py-2 text-gray-700 hover:bg-gray-50"
            >
              Charge Codes{filters.chargeCodeIds.size > 0 ? ` (${filters.chargeCodeIds.size})` : ''}
            </button>
            {chargeCodeMenuOpen && (
              <div className="absolute z-10 mt-1 w-64 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg py-1">
                {chargeCodes.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No charge codes.</p>
                )}
                {chargeCodes.map((cc) => (
                  <label
                    key={cc.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={filters.chargeCodeIds.has(cc.id)}
                      onChange={() => toggleChargeCode(cc.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{cc.code}</span>
                    {cc.description && <span className="text-gray-500 truncate">{cc.description}</span>}
                  </label>
                ))}
                {filters.chargeCodeIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, chargeCodeIds: new Set() }))}
                    className="w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-gray-50 border-t border-gray-100 mt-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <ExportMenu options={exportOptions} />

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <span className="text-sm text-gray-500">{selectedTotalHours} hours</span>
            {canCreateInvoice ? (
              <button
                onClick={handleCreateInvoice}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Create Invoice
              </button>
            ) : allSelectedUnbilled && selectedClientIds.size > 1 ? (
              <span className="text-sm text-amber-600">Selected entries span multiple clients</span>
            ) : null}
          </div>
        )}
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'started_at', label: 'StartTime' },
                    { key: 'stopped_at', label: 'EndTime' },
                    { key: 'hours', label: 'Hours' },
                    { key: 'client', label: 'Client' },
                    { key: 'project', label: 'Project / Code' },
                    { key: 'task', label: 'Task' },
                    { key: 'description', label: 'Description' },
                  ].map(({ key, label }) => sortableColumns.includes(key) ? (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    >
                      {label}{sortIndicator(key)}
                    </th>
                  ) : (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-400">No time entries found.</td>
                  </tr>
                )}
                {sortedEntries.map((entry) => {
                  const invoiced = Boolean(entry.invoice);
                  return (
                    <tr key={entry.id} className={`hover:bg-gray-50 ${selected.has(entry.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleOne(entry.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(entry.started_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDateTime(entry.stopped_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{entry.hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{clientNameForEntry(entry)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {entry.project
                          ? entry.project.name
                          : <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{entry.charge_code?.code}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{entry.task?.title || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{entry.description || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {invoiced
                          ? <Link to={`/invoices/${entry.invoice!.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                            {entry.invoice!.number}
                          </Link>
                          : <span className="text-gray-400">Unbilled</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-sm space-x-3 whitespace-nowrap">
                        {invoiced ? (
                          <span className="text-gray-300">Locked</span>
                        ) : (
                          <>
                            <Link
                              to={`/timesheets/${entry.id}/edit`}
                              state={entry.charge_code
                                ? { chargeCodeId: entry.charge_code_id, clientId: entry.client_id }
                                : { projectId: entry.project?.id, clientId: entry.project?.client_id }
                              }
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              Edit
                            </Link>
                            <button onClick={() => handleDelete(entry)} className="text-red-500 hover:text-red-700">
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per entry — same data as the table above, laid out for a phone
              instead of scrolled sideways. Sorting/selection/bulk-invoice all still work here,
              same handlers as the desktop table. */}
          <div className="md:hidden bg-white rounded-lg shadow divide-y divide-gray-200">
            {entries.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No time entries found.</p>
            )}
            {entries.length > 0 && (
              <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {allChecked ? 'Deselect all' : someChecked ? `${selected.size} selected` : 'Select all'}
              </label>
            )}
            {sortedEntries.map((entry) => {
              const invoiced = Boolean(entry.invoice);
              return (
                <div key={entry.id} className={`p-4 ${selected.has(entry.id) ? 'bg-indigo-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleOne(entry.id)}
                      className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">{formatDate(entry.date)}</span>
                        <span className="text-sm font-medium text-gray-900">{entry.hours.toFixed(2)} hrs</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {clientNameForEntry(entry)}
                        {' · '}
                        {entry.project
                          ? entry.project.name
                          : <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{entry.charge_code?.code}</span>
                        }
                      </div>
                      {entry.task?.title && <div className="text-sm text-gray-500 mt-0.5">{entry.task.title}</div>}
                      {entry.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{entry.description}</div>}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs">
                          {invoiced
                            ? <Link to={`/invoices/${entry.invoice!.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                              {entry.invoice!.number}
                            </Link>
                            : <span className="text-gray-400">Unbilled</span>
                          }
                        </div>
                        <div className="text-sm space-x-3">
                          {invoiced ? (
                            <span className="text-gray-300">Locked</span>
                          ) : (
                            <>
                              <Link
                                to={`/timesheets/${entry.id}/edit`}
                                state={entry.charge_code
                                  ? { chargeCodeId: entry.charge_code_id, clientId: entry.client_id }
                                  : { projectId: entry.project?.id, clientId: entry.project?.client_id }
                                }
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                Edit
                              </Link>
                              <button onClick={() => handleDelete(entry)} className="text-red-500 hover:text-red-700">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length > 0 && (
            <div className="mt-3 text-right text-sm font-medium text-gray-700">
              Total: <span className="text-gray-900">{totalHours.toFixed(2)} hrs</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
