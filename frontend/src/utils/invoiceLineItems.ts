import type { InvoiceLineItemDetail } from '../types';

type LineItemProject = NonNullable<InvoiceLineItemDetail['project']>;

// Mirrors the grouping/consolidation rules in app/views/pdfs/_line_items_table.html.erb for
// invoices — keep both in sync. A client invoice can span several projects (each with its own
// display settings) plus project-less charge-code entries, so this groups by project first, then
// applies each project's own show_task_breakdown/show_hours within its own group.

export interface InvoiceDisplayRow {
  id: string;
  date: string | null;
  projectName: string;
  description: string;
  hours: number | null; // null renders as an em-dash — non-"time" kind lines have no real hours
  rate: number | null;
  amount: number | null; // null only for a text-only row
  isTextOnly: boolean; // a custom line with no amount at all — renders as a plain spanning row
}

function effectiveTask(item: InvoiceLineItemDetail) {
  return item.task ?? item.time_entry?.task;
}

function isChargeCode(item: InvoiceLineItemDetail): boolean {
  return Boolean(item.time_entry?.charge_code);
}

function toRow(item: InvoiceLineItemDetail): InvoiceDisplayRow {
  // "time" always has real hours; a custom line only has real hours when it was actually filled
  // in (e.g. calculated from attached time entries) — fixed/adjustment lines' hours are a
  // meaningless stored 0.
  const showRealHours = item.kind === 'time' || (item.kind === 'custom' && item.hours != null);
  return {
    id: String(item.id),
    date: item.time_entry?.date ?? null,
    projectName: item.time_entry?.project?.name || item.project?.name || item.time_entry?.charge_code?.code || '—',
    description: item.description || '—',
    hours: showRealHours ? item.hours : null,
    rate: item.kind === 'time' ? item.rate : null,
    amount: item.amount,
    isTextOnly: item.kind === 'custom' && item.amount == null,
  };
}

// Collapses a project's "time" kind lines into one summary row per Task Group, named after the
// group. A line with no task at all has no group to fold into and stays itemized on its own.
function consolidateByTaskGroup(timeItems: InvoiceLineItemDetail[], projectName: string): InvoiceDisplayRow[] {
  const groupable = timeItems.filter((i) => effectiveTask(i)?.task_group);
  const ungroupable = timeItems.filter((i) => !effectiveTask(i)?.task_group);

  const groups = new Map<number, { title: string; position: number; items: InvoiceLineItemDetail[] }>();
  for (const item of groupable) {
    const group = effectiveTask(item)!.task_group!;
    if (!groups.has(group.id)) groups.set(group.id, { title: group.title, position: group.position, items: [] });
    groups.get(group.id)!.items.push(item);
  }

  const groupRows: InvoiceDisplayRow[] = [...groups.values()]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      id: `group-${group.title}`,
      date: null,
      projectName,
      description: group.title,
      hours: group.items.reduce((sum, i) => sum + (i.hours ?? 0), 0),
      rate: null,
      amount: group.items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
      isTextOnly: false,
    }));

  return [...groupRows, ...ungroupable.map(toRow)];
}

export function visibleInvoiceRows(items: InvoiceLineItemDetail[]): { rows: InvoiceDisplayRow[]; showHours: boolean } {
  // Generator-created lines all have position: null and keep their existing id order (stable,
  // matches today's behavior); a custom invoice's explicitly-positioned lines sort by that
  // position instead. Mirrors the ORDER BY in PdfGenerator/_line_items_table.html.erb.
  const sortedItems = [...items].sort((a, b) => {
    const aPos = a.position ?? Infinity;
    const bPos = b.position ?? Infinity;
    return aPos !== bPos ? aPos - bPos : a.id - b.id;
  });

  const projectGroups = new Map<number | null, { project: LineItemProject | null; items: InvoiceLineItemDetail[] }>();
  for (const item of sortedItems) {
    const key = item.project?.id ?? null;
    if (!projectGroups.has(key)) projectGroups.set(key, { project: item.project ?? null, items: [] });
    projectGroups.get(key)!.items.push(item);
  }

  // A single project's setting decides the columns when the whole invoice is that one project
  // (the common case) — a multi-project invoice with genuinely differing settings falls back to
  // showing full detail rather than guessing which project's preference should win.
  const projectsInvolved = [...projectGroups.values()].map((g) => g.project).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const uniformProject = projectsInvolved.length <= 1 ? projectsInvolved[0] : undefined;
  const showHours = uniformProject ? uniformProject.show_hours : true;

  const rows: InvoiceDisplayRow[] = [];
  for (const { project, items: groupItems } of projectGroups.values()) {
    const showTaskBreakdown = project ? project.show_task_breakdown : true;
    const chargeCodeItems = groupItems.filter(isChargeCode);
    const projectItems = groupItems.filter((i) => !isChargeCode(i));
    const fixedItems = projectItems.filter((i) => i.kind !== 'time');
    const timeItems = projectItems.filter((i) => i.kind === 'time');

    const timeRows = showTaskBreakdown ? timeItems.map(toRow) : consolidateByTaskGroup(timeItems, project?.name || 'Time');
    rows.push(...timeRows, ...fixedItems.map(toRow), ...chargeCodeItems.map(toRow));
  }

  return { rows, showHours };
}
