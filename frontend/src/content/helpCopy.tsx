// All contextual help copy (rendered via <HelpButton>) lives here, in one place, so wording can
// be found and updated without hunting through the pages/components that use it. Each entry is
// { title, content } — title becomes the HelpButton's heading, content is the JSX body.

export const hstReturnsListHelp = {
  title: 'About HST Returns',
  content: (
    <>
      <p>
        Each return covers one filing period and mirrors the lines the CRA asks for on a
        GST/HST return:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Line 101 — Total Revenue:</strong> sum of your invoiced revenue for the period.</li>
        <li><strong>Line 103 — HST Collected:</strong> the HST charged to clients on those invoices.</li>
        <li><strong>Line 106 — Input Tax Credits (ITCs):</strong> the HST you paid on business expenses, which reduces what you owe. This is calculated from your logged Expenses but can be overridden.</li>
        <li><strong>Net Tax:</strong> Line 103 minus Line 106 — what you owe the CRA (or, if negative, your refund, shown in green).</li>
      </ul>
      <p>
        <strong>Status</strong> is just a tracker for your own records — <em>Draft</em> →{' '}
        <em>Filed</em> (once you've actually submitted it to the CRA) → <em>Paid</em>. Marking
        a return as Filed or Paid here doesn't file or pay anything on your behalf.
      </p>
    </>
  ),
};

export const hstReturnDetailHelp = {
  title: 'This HST Return',
  content: (
    <>
      <p>
        <strong>Line 106 (Input Tax Credits)</strong> is editable here even though it's
        calculated from your Expenses — use this if you have ITCs that weren't logged as
        expenses, or need to correct the auto-calculated figure.
      </p>
      <p>
        <strong>Net Tax</strong> updates live as you change the ITC figure: positive means you
        owe the CRA, negative (shown in green) means you're due a refund.
      </p>
      <p>
        This app doesn't submit anything to the CRA — <strong>Mark as Filed</strong> and{' '}
        <strong>Mark as Paid</strong> just update your own records after you've filed/paid
        through the CRA's actual channels. You can still edit the figures on a return after
        marking it Filed, so double-check before relying on it as a permanent record.
      </p>
    </>
  ),
};

export const newHstReturnDialogHelp = {
  title: 'Choosing a Period',
  content: (
    <>
      <p>
        The dates below default to the <strong>previous calendar quarter</strong>. If you
        file HST annually or monthly, change these to match your actual CRA filing period
        before calculating — the default won't be right for you.
      </p>
      <p>
        "Recalculate" pulls Line 101/103 from invoices dated in this range, and Line 106
        from expenses in the same range. You can still override the ITC figure by hand
        afterward.
      </p>
    </>
  ),
};

export const projectRateHelp = {
  title: 'How Rates Are Resolved',
  content: (
    <>
      <p>
        When you billing time on this project, the rate used is looked up in this
        order: <strong>this project's rate</strong> → the <strong>client's default
        rate</strong> → $0.
      </p>
      <p>
        This field is pre-filled from the client's rate when you first pick a client,
        but once saved it's an <strong>independent value</strong> — changing the
        client's default rate later won't update it. Leaving it blank on a new project
        means it'll follow the client's rate; note that blanking it out on a project
        that already has a rate saved won't clear that rate.
      </p>
    </>
  ),
};

export const projectBillingHelp = {
  title: 'Billing Mode & Document Display',
  content: (
    <>
      <p>
        <strong>Billing Mode</strong> controls how much a project's invoices charge:{' '}
        <strong>Hourly</strong> bills actual hours worked × rate (today's default, unchanged).{' '}
        <strong>Fixed Price</strong> bills one agreed total, once — the first invoice generated
        for the project includes the full amount regardless of hours logged, and generating again
        won't bill it a second time. <strong>Capped</strong> bills actual hours as usual but never
        lets the pre-tax subtotal exceed the agreed ceiling; time pushed over the cap is written
        off (not carried to a future invoice), and once the cap is fully used, that project is
        skipped rather than producing a $0 line — a client invoice bundles every one of a
        client's projects together, so an exhausted cap on one project doesn't block billing the
        others; you'll see a warning naming which project was skipped. The cap only bounds
        billable work — tax is still calculated on top and can push the client's total above the
        cap number.
      </p>
      <p>
        For both Fixed Price and Capped, the <strong>Billing Amount is a lifetime total for the
        whole project</strong>, not per-invoice or per-period — it tracks everything ever billed
        for this project, across however many separate invoices you generate over time (e.g. one
        per month). Fixed Price is billed exactly once, ever; a capped project keeps consuming the
        same ceiling invoice after invoice until it's used up.
      </p>
      <p>
        <strong>Estimates respect the same rules as Invoices for both modes</strong> — a Fixed
        Price estimate shows the agreed total (not a raw hours × rate quote), and a Capped
        estimate is written down so it never quotes more than what's actually left of the cap
        (net of anything already invoiced for the project) — so a client is never quoted more than
        they could actually be charged.
      </p>
      <p>
        The three checkboxes below are independent of billing mode and apply to both Estimates
        and Invoices: whether the document lists <strong>each task as its own line</strong> versus
        one consolidated line per <strong>Task Group</strong>, whether an{' '}
        <strong>Hours/Rate column</strong> appears at all, and — when hours are shown — whether a
        task's <strong>actual hours</strong> replace its estimated hours once the task is marked
        done, or the document keeps showing the original estimate throughout. All three default to
        today's behavior, so existing projects are unaffected.
      </p>
      <p>
        Task Group titles are already client-facing either way — every task's line is prefixed
        with its group's title (e.g. "Website Development · Kickoff meeting") even with breakdown
        on. Turning breakdown off just makes that prefix the <strong>entire</strong> line: one row
        per group, titled with just the group name, with all its tasks' hours and amounts summed
        into it.
      </p>
      <p>
        <strong>Fixed Price always uses estimated hours, never actual</strong> — the whole point
        of Fixed Price is billing the agreed total regardless of how work goes, so "actual hours"
        doesn't apply to it. This is enforced automatically: the "Show actual hours" checkbox is
        disabled while Billing Mode is Fixed Price.
      </p>
    </>
  ),
};

export const customInvoiceHelp = {
  title: 'Custom Invoices',
  content: (
    <>
      <p>
        A custom invoice is built entirely by hand — there's no generator run, no time entries
        required to start. Useful for anything the normal "bill unbilled hours" flow doesn't
        fit, most commonly <strong>splitting a Fixed Price project into milestone
        payments</strong> (e.g. half up front, half on completion) across two or more separate
        invoices, since a Fixed Price project is otherwise billed in one shot, exactly once.
      </p>
      <p>
        Each row's fields are all optional — leave <strong>Amount</strong> blank and the row
        becomes a plain text line (e.g. a section label like "Phase 1: Design") with nothing
        billed on it. Fill in an amount and it's a real billable line; Hours/Rate are
        independent of Amount and never required — a milestone payment doesn't have to be
        hours × rate.
      </p>
      <p>
        <strong>Attach time</strong> lets you check off this project's unbilled time entries to
        calculate a row's Hours — their hours are summed in as a starting point (still editable
        afterward), and those entries are marked billed against this invoice so they won't show
        up as unbilled again. This is a one-time calculation, not a lasting link — nothing
        tracks which entries fed a given row's hours after the fact.
      </p>
      <p>
        If a Fixed Price project's custom invoices end up totaling more than its agreed price,
        you'll see a warning after saving — it's informational only and never blocks saving, so
        you stay in control of exactly how the total gets split.
      </p>
    </>
  ),
};

export const disbursementsHelp = {
  title: 'How Disbursements Work',
  content: (
    <>
      <p>
        A <strong>disbursement</strong> is an out-of-pocket cost you paid on behalf of this
        project that you intend to pass on to the client at cost — things like a stock photo
        license, a domain registration, or shipping. It's not your own time or labour; that's
        tracked separately through time entries.
      </p>
      <p>
        Disbursements are <strong>pass-through reimbursements, not taxed</strong> — they're
        billed at exactly the amount you enter, with no tax applied, unlike hourly line items.
      </p>
      <p>
        Every disbursement on a project — paid or not — is automatically included whenever you
        generate an <strong>Estimate</strong> for that project. The <strong>Paid</strong> checkbox
        is just your own record of whether you've paid the underlying cost yet; it doesn't affect
        whether it appears on an estimate, and disbursements aren't currently added to Invoices.
      </p>
    </>
  ),
};

export const timesheetsListHelp = {
  title: 'Locked Time Entries',
  content: (
    <>
      <p>
        A time entry shows <strong>Locked</strong> once it's been included as a line item on an
        invoice — at that point it can no longer be edited or deleted, so the invoice you sent
        always matches what was actually billed.
      </p>
      <p>
        To change a locked entry, you have to undo the billing first: delete the invoice it's on
        (from the Invoices page), which removes that line item and unlocks the entry — then edit
        it and re-invoice as needed.
      </p>
    </>
  ),
};

export const timesheetFormHelp = {
  title: 'Entering Time',
  content: (
    <>
      <p>
        There are two ways to record hours here, and only one is active at a time:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Start/End time:</strong> fill in both and <strong>Hours</strong> is calculated
          for you automatically — the field becomes read-only, since it's derived from the times.
        </li>
        <li>
          <strong>Hours directly:</strong> leave Start/End time blank and type the number of
          hours yourself. This is the only option for a quick entry where you don't know or care
          about the exact clock times.
        </li>
      </ul>
      <p>
        To switch from a calculated entry back to a typed one, clear both the Start and End time
        fields — Hours unlocks for editing again. Clients will not see start and end times.
      </p>
      <p>
        <strong>Description</strong> is optional, but it's not just a personal note — once this
        entry is invoiced, its description becomes part of that line item's text on the actual
        invoice PDF the client sees (alongside the task group/task name, or the charge code for
        non-project entries). Write it with the client as the reader.
      </p>
    </>
  ),
};

export const invoiceContactsHelp = {
  title: '"Bill To" vs. "Send To"',
  content: (
    <>
      <p>
        <strong>Bill To</strong> is the contact permanently recorded on this invoice — it's who's
        printed on the document itself. Changing it here is a real, saved change: if a PDF has
        already been generated, it's automatically regenerated so the document matches the new
        Bill To contact.
      </p>
      <p>
        <strong>Send To</strong> (the picker you get when clicking Send Invoice / Send Receipt, if
        the client has more than one contact) is a <strong>one-time override</strong> for that
        single email only. It does <strong>not</strong> change the invoice's stored Bill To, and it
        does <strong>not</strong> regenerate the PDF — the attached document still shows the
        original Bill To contact's name and address, even if you send the email to someone else.
        Use it for things like cc'ing a bookkeeper a one-off copy without altering the invoice
        record.
      </p>
      <p>
        If the client only has one contact, there's nothing to choose — sending just asks you to
        confirm sending to that person directly.
      </p>
    </>
  ),
};

export const ccaScheduleHelp = {
  title: 'How CCA Works',
  content: (
    <>
      <p>
        <strong>UCC (Undepreciated Capital Cost)</strong> is what's left of an asset's value to
        depreciate. <strong>UCC Opening</strong> is that balance at the start of the tax year you're
        viewing; <strong>Additions</strong>/<strong>Disposals</strong> adjust it for costs added to
        or amounts removed from the asset during that year.
      </p>
      <p>
        In an asset's <strong>year of purchase</strong>, the CRA only allows half the normal rate —
        this app applies that half-year rule for you automatically.
      </p>
      <p>
        <strong>Important:</strong> UCC Opening, Additions, and Disposals are single values stored
        per asset — switching the Tax Year dropdown recalculates the deduction using whatever is
        currently saved, it does <strong>not</strong> automatically roll the balance forward from a
        prior year. Before working in a new tax year, update each asset's UCC Opening yourself to
        last year's closing balance (last year's UCC Opening + Additions − Disposals − last year's
        CCA deduction).
      </p>
    </>
  ),
};

export const homeOfficeHelp = {
  title: 'Home Office Deduction',
  content: (
    <>
      <p>
        The CRA lets you determine your business-use percentage either by{' '}
        <strong>room count</strong> (office rooms ÷ total rooms) or{' '}
        <strong>square footage</strong> (office sq ft ÷ total sq ft) — pick whichever method you
        actually use for your own records.
      </p>
      <p>
        The deduction is: monthly home costs × 12 × your business-use percentage. For{' '}
        <strong>Rent / Mortgage interest</strong>, only enter the <strong>interest</strong> portion
        of a mortgage payment — mortgage principal repayment isn't deductible.
      </p>
      <p>
        Not enforced by this app: the CRA doesn't let a home office deduction create or increase a
        business loss (it can only reduce net income to zero), and any unused portion carries
        forward to next year. This app doesn't track that carry-forward — keep your own note if it
        applies to you.
      </p>
    </>
  ),
};

export const t2125ReportHelp = {
  title: 'About This Report',
  content: (
    <>
      <p>
        This is a <strong>read-only summary</strong> mirroring the CRA's T2125 form and its line
        numbers, assembled automatically from your Invoices, Expenses, CCA Schedule, and Home
        Office settings for the selected year. It's a reference to help you fill out your actual
        return, not a filing itself.
      </p>
      <p>
        <strong>Heads up:</strong> "Meals &amp; Entertainment (50%)" is labeled that way because the
        CRA only lets you deduct half of those costs — but this report shows the{' '}
        <strong>full amount</strong> you logged as an expense, not the halved figure. Reduce that
        category by half yourself before using it on your actual return.
      </p>
      <p>
        HST collected is subtracted from gross revenue because it was never your income — it was
        always the CRA's money, just collected through you.
      </p>
    </>
  ),
};

export const estimateDetailHelp = {
  title: 'Live Updates & Changes',
  content: (
    <>
      <p>
        The numbers on <strong>this web page</strong> recalculate every time you open it. Once a
        task shown here is marked <strong>Done</strong>, its row automatically swaps the original
        estimated hours/amount for the <strong>actual</strong> hours logged against that task
        (rate × actual hours), and the <strong>Estimated Total</strong> updates to match — live,
        from the project's current task statuses and time entries. This only happens when the
        project's "Show actual hours" setting is on (Project → Billing) — turn it off and Done
        tasks keep showing their original estimate here too. <strong>Fixed Price projects always
        show the original estimate, regardless of that setting</strong> — Fixed Price bills the
        agreed total no matter how the work actually goes, so there's no "actual vs. estimated"
        distinction to show.
      </p>
      <p>
        The <strong>PDF</strong> is different: it's a frozen snapshot from whenever it was last
        generated or regenerated, and does <strong>not</strong> pick up these live changes on its
        own — even if it's never been sent. If the numbers on this page have moved since the PDF
        was made, click <strong>Regenerate PDF</strong> to bring the document in line with them
        before sending it.
      </p>
      <p>
        The amber <strong>"Changes since last sent"</strong> box compares this estimate's current
        line items against a snapshot taken the last time you clicked <strong>Send Estimate</strong>.
        It only appears once an estimate has been sent at least once, and only when something has
        actually changed:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Added / Removed:</strong> a task or disbursement joined or dropped off the project's estimate.</li>
        <li><strong>Revised:</strong> a task's estimated hours changed.</li>
        <li><strong>Completed:</strong> a task was marked Done and its actual hours differ from what was last sent.</li>
      </ul>
      <p>
        It's there to help you know what to call out when you re-send an updated estimate — it's
        informational, not something you edit directly.
      </p>
      <p>
        One more thing: clicking <strong>Create Estimate</strong> / <strong>Update Estimate</strong>{' '}
        on the project page always creates a brand-new estimate snapshot of the project's current
        billable tasks and disbursements, rather than editing an existing one in place — that's
        why a project can end up with more than one estimate listed.
      </p>
    </>
  ),
};

export const timerPageHelp = {
  title: 'How the Timer Attributes Time',
  content: (
    <>
      <p>
        A running timer is <strong>one continuous session linked to a single task</strong> (or no
        task at all). When you click <strong>Save time entry</strong>, the entire elapsed time —
        from when you hit Start to right now — becomes one time entry, credited entirely to
        whichever task is currently linked. Starting with a task selected marks it{' '}
        <strong>In Progress</strong> immediately; saving offers to mark it <strong>Done</strong>.
      </p>
      <p>
        Selecting a <strong>different</strong> task while the timer is already running asks how to
        handle it — and the two real options behave very differently:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Keep current task:</strong> cancels the switch, nothing changes.</li>
        <li>
          <strong>Replace current task:</strong> re-links this <em>same</em> running session to the
          new task. This does <strong>not</strong> split the time — every second already elapsed,
          plus everything from now until you stop, will be attributed entirely to the new task once
          saved. None of it goes to the task you switched away from.
        </li>
        <li>
          <strong>Start new session:</strong> closes out the current elapsed time as a finished
          entry for the <em>old</em> task, then starts a brand-new timer at 0:00 for the new one.
          This is the option to use if you actually want the time split correctly between two
          tasks.
        </li>
      </ul>
      <p>
        If no timer is running yet, selecting a task just stages it to start with next (or starts
        one immediately, after a quick confirmation). If you forget to run the timer you can always log time on the timesheets page.
      </p>
    </>
  ),
};

export const taskGroupsHelp = {
  title: 'How Task Groups Work',
  content: (
    <>
      <p>
        A project's work is organized into <strong>groups</strong> (e.g. "Design", "Backend"),
        each holding a list of <strong>tasks</strong>. Drag the ⠿ handle to reorder tasks or
        groups, use the ▲▼ arrows to move a whole group, and "Merge" to fold a group into the
        one above it — these actions can't be undone.
      </p>
      <p>
        <strong>Estimate</strong> (the "+ est." chip) is a number you set by hand — it's a
        plan, not a measurement. <strong>Actual</strong> only appears once time has actually
        been logged against that task (via the timer or a timesheet entry), and is computed
        automatically — you can't edit it directly.
      </p>
      <p>
        "Import tasks from Statement of Work" (SOW Import) uses AI to read an uploaded
        document and automatically creates a full set of groups and tasks from it — review
        what it creates, since it's a starting point, not always exact.
      </p>
      <p>
        Group titles aren't just internal organization — they're already client-facing today:
        every task's line on an Estimate/Invoice is prefixed with its group's title (e.g. "Website
        Development · Kickoff meeting"). If this project's "Show task breakdown" setting
        (Project → Billing) is off, that prefix becomes the <strong>entire</strong> line — one row
        per group, titled with just the group name, with all its tasks' hours and amounts summed
        into it. Name groups with the client as the reader in mind either way.
      </p>
    </>
  ),
};
