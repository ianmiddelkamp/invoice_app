import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, createProject, updateProject, toggleArchive, AI_SUMMARY_PURPOSES } from '../../api/projects';
import { downloadExport } from '../../utils/export';
import ExportMenu from '../../components/ExportMenu';
import { getClients } from '../../api/clients';
import { getProjectRate, setProjectRate, getClientRate } from '../../api/rates';
import { getEstimates } from '../../api/estimates';
import PageHeader from '../../components/PageHeader';
import HelpButton from '../../components/HelpButton';
import { projectRateHelp, projectBillingHelp } from '../../content/helpCopy';
import TaskBoard from '../../components/TaskBoard';
import ProjectDisbursements from '../../components/ProjectDisbursements';
import ProjectEstimates from '../../components/ProjectEstimates';
import ProjectAttachments from '../../components/ProjectAttachments';
import { getAttachments } from '../../api/attachments';
import type { Client, Attachment } from '../../types';
import { confirm } from '../../services/dialog';

const BILLING_MODE_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'capped', label: 'Capped' },
];

const EMPTY = {
  name: '',
  client_id: '',
  description: '',
  billing_mode: 'hourly',
  billing_amount: '',
  show_task_breakdown: true,
  show_hours: true,
  show_actual_hours: true,
};

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const projectId = id ? Number(id) : undefined;

  const [form, setForm] = useState(EMPTY);
  const [rate, setRateValue] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [archived, setArchived] = useState(false)

  const [summaryPurpose, setSummaryPurpose] = useState(AI_SUMMARY_PURPOSES[0].key);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryAttachments, setSummaryAttachments] = useState<Attachment[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<number>>(new Set());
  const [latestEstimateTotal, setLatestEstimateTotal] = useState<number | null>(null);

  const detailsRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<HTMLDivElement>(null);
  const disbursementsRef = useRef<HTMLDivElement>(null);
  const estimatesRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    getClients().then((data) => { if (data) setClients(data); }).catch((e) => setError(e.message));

    if (isEdit && projectId) {
      getProject(projectId)
        .then((p) => {
          if (p) {
            setForm({
              name: p.name,
              client_id: String(p.client_id),
              description: p.description || '',
              billing_mode: p.billing_mode || 'hourly',
              billing_amount: p.billing_amount != null ? String(p.billing_amount) : '',
              show_task_breakdown: p.show_task_breakdown,
              show_hours: p.show_hours,
              show_actual_hours: p.show_actual_hours,
            });
            setArchived(p.is_archived)
          }
        })
        .catch((e) => setError(e.message));

      getProjectRate(projectId)
        .then((r) => setRateValue(r?.rate != null ? String(r.rate) : ''))
        .catch(() => { });

      getEstimates(projectId)
        .then((estimates) => {
          // estimates come back ordered oldest → newest
          const latest = estimates?.[estimates.length - 1];
          if (latest?.total != null) setLatestEstimateTotal(latest.total);
        })
        .catch(() => { });

      loadSummaryAttachments(projectId);
    }
  }, [id, isEdit]);

  function loadSummaryAttachments(id: number) {
    getAttachments(id).then((data) => { if (data) setSummaryAttachments(data); }).catch(() => {});
  }

  function toggleAttachment(id: number) {
    setSelectedAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'client_id' && !isEdit && value) {
      getClientRate(Number(value))
        .then((r) => { if (r?.rate != null) setRateValue(String(r.rate)); })
        .catch(() => { });
    }
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  }

  function useLatestEstimateTotal() {
    if (latestEstimateTotal != null) {
      setForm((prev) => ({ ...prev, billing_amount: String(latestEstimateTotal) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        client_id: Number(form.client_id),
        billing_amount: form.billing_amount !== '' ? parseFloat(form.billing_amount) : null,
      };

      let pid: number;
      if (isEdit && projectId) {
        await updateProject(projectId, payload);
        pid = projectId;
      } else {
        const created = await createProject(payload);
        if (!created) return;
        pid = created.id;
      }

      if (rate !== '') {
        await setProjectRate(pid, parseFloat(rate));
      }

      if (isEdit) {
        // Stay on the page — the sections below (Task Groups, Estimates, etc.) are exactly
        // what someone editing a project wants to keep working in, not something to bounce
        // away from on every save.
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      } else {
        // A brand-new project has none of those sections until it exists, so land on its own
        // edit page rather than the list.
        navigate(`/projects/${pid}/edit`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSummary(format: 'docx' | 'md') {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const purposeSlug = summaryPurpose.replace(/_/g, '-');
      await downloadExport(`/projects/${projectId}/ai_summary`, `${purposeSlug}.${format}`, {
        method: 'POST',
        body: JSON.stringify({ purpose: summaryPurpose, format, attachment_ids: [...selectedAttachmentIds] }),
      });
    } catch (err) {
      setSummaryError((err as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  const summaryExportOptions = [
    { label: 'Doc', onClick: () => handleGenerateSummary('docx') },
    { label: 'Markdown', onClick: () => handleGenerateSummary('md') },
  ];

  async function confirmArchive() {
    const ok = await confirm(`${archived ? "Un-Archive" : "Archive"} this project?`)
    if (ok) {
      try {
        const response = await toggleArchive(projectId!, !archived)
        if (response?.success) {
          setArchived(!archived)
        }
      } catch (err) {
        setError((err as Error).message);
      }

    }
  }

  const sections = isEdit && projectId
    ? [
        { label: 'Details', ref: detailsRef },
        { label: 'Task Groups', ref: tasksRef },
        { label: 'Disbursements', ref: disbursementsRef },
        { label: 'Estimates', ref: estimatesRef },
        { label: 'Files', ref: filesRef },
        { label: 'AI Summary', ref: summaryRef },
        { label: 'Actions', ref: actionsRef },
      ]
    : [];

  return (
    <div className="p-8">
      <PageHeader title={isEdit ? 'Edit Project' : 'New Project'} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      {sections.length > 0 && (
        <nav
          className="hidden xl:flex flex-col gap-1 fixed right-6 top-1/2 -translate-y-1/2 z-10
                     bg-white rounded-xl shadow border border-gray-200 py-3 px-1"
          aria-label="Project sections"
        >
          {sections.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => scrollToSection(s.ref)}
              className="group flex items-center gap-2 text-left text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-md px-3 py-1.5 whitespace-nowrap transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-indigo-500 transition-colors flex-shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-8 items-stretch">
        <div ref={detailsRef} className="w-full max-w-3xl scroll-mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Details</h3>
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
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

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                Hourly Rate ($)
                <HelpButton title={projectRateHelp.title}>{projectRateHelp.content}</HelpButton>
              </label>
              <input
                type="number"
                name="rate"
                value={rate}
                onChange={(e) => setRateValue(e.target.value)}
                min="0"
                step="0.01"
                placeholder="e.g. 150.00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="border border-gray-200 rounded-md p-4 space-y-4">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Billing
                <HelpButton title={projectBillingHelp.title}>{projectBillingHelp.content}</HelpButton>
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Billing Mode</label>
                <select
                  name="billing_mode"
                  value={form.billing_mode}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {BILLING_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {form.billing_mode !== 'hourly' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {form.billing_mode === 'fixed_price' ? 'Fixed Price Total ($)' : 'Billing Cap ($)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="billing_amount"
                      value={form.billing_amount}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {latestEstimateTotal != null && (
                      <button
                        type="button"
                        onClick={useLatestEstimateTotal}
                        className="whitespace-nowrap text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Use latest estimate (${latestEstimateTotal.toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="show_task_breakdown"
                    checked={form.show_task_breakdown}
                    onChange={handleCheckboxChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show task breakdown on documents
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="show_hours"
                    checked={form.show_hours}
                    onChange={handleCheckboxChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show hours/rate column
                </label>
                <label className={`flex items-center gap-2 text-sm cursor-pointer select-none ${form.billing_mode === 'fixed_price' ? 'text-gray-400' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    name="show_actual_hours"
                    checked={form.billing_mode === 'fixed_price' ? false : form.show_actual_hours}
                    disabled={form.billing_mode === 'fixed_price'}
                    onChange={handleCheckboxChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                  />
                  Show actual hours once a task is done
                  {form.billing_mode === 'fixed_price' && (
                    <span className="text-xs">— not applicable to Fixed Price, which always bills the agreed total</span>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              {justSaved && <span className="text-sm text-green-600">Saved</span>}
            </div>
          </form>
        </div>

        {isEdit && projectId && (
          <div ref={tasksRef} className="w-full scroll-mt-8">
            <TaskBoard projectId={projectId} />
          </div>
        )}

        {isEdit && projectId && (
          <div ref={disbursementsRef} className="w-full scroll-mt-8">
            <ProjectDisbursements projectId={projectId} />
          </div>
        )}
        {isEdit && projectId && (
          <div ref={estimatesRef} className="w-full scroll-mt-8">
            <ProjectEstimates projectId={projectId} />
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate(`/invoices/custom/new?project_id=${projectId}`)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Create Custom Invoice
              </button>
            </div>
          </div>
        )}
        {isEdit && projectId && (
          <div ref={filesRef} className="w-full scroll-mt-8">
            <ProjectAttachments projectId={projectId} />
          </div>
        )}

        {isEdit && projectId && (
          <div ref={summaryRef} className="w-full max-w-3xl scroll-mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Summary</h3>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Generates a summary from this project's details, task groups, and any documents you select below
                using Claude, and downloads it in the format you choose.
              </p>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-sm font-medium text-gray-700">Include documents</span>
                  {projectId && (
                    <button
                      type="button"
                      onClick={() => loadSummaryAttachments(projectId)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Refresh list
                    </button>
                  )}
                </div>
                {summaryAttachments.length === 0 ? (
                  <p className="text-sm text-gray-400">No files attached to this project yet.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {summaryAttachments.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedAttachmentIds.has(a.id)}
                          onChange={() => toggleAttachment(a.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {a.filename}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={summaryPurpose}
                  onChange={(e) => setSummaryPurpose(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {AI_SUMMARY_PURPOSES.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                <ExportMenu options={summaryExportOptions} disabled={summaryLoading} />
              </div>

              {summaryError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{summaryError}</div>
              )}
            </div>
          </div>
        )}

        {isEdit && (
          <div ref={actionsRef} className="w-full scroll-mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Actions</h3>
            <div className="bg-white rounded-lg shadow p-6 space-y-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={confirmArchive}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${archived ? "bg-indigo-600" : "bg-red-500"}`}>
                  {archived ? "Un-archive" : "Archive"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
