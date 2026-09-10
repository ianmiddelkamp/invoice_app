class InvoiceGenerator
  # Populated during generate! with one message per capped project skipped for having already
  # reached its cap — read after calling generate! (empty array if nothing was skipped).
  attr_reader :warnings

  def initialize(client:, contact:, start_date: nil, end_date: nil, time_entry_ids: nil)
    @client          = client
    @contact         = contact
    @start_date      = start_date
    @end_date        = end_date
    @time_entry_ids  = time_entry_ids
    @tax_rate        = @client.business_profile.tax_rate || 0
    @warnings        = []
  end

  def generate!
    time_entries = sort_entries(@time_entry_ids.present? ? specific_entries : unbilled_entries)
    by_project = time_entries.group_by(&:project_id)

    # Fixed Price must be able to bill with zero logged time entries at all, so on a full
    # client-wide generation (not a hand-picked set of specific entries) any of the client's
    # not-yet-billed fixed-price projects get an empty group of their own to dispatch into.
    if @time_entry_ids.blank?
      unbilled_fixed_price_projects(by_project.keys).each { |p| by_project[p.id] ||= [] }
    end

    return nil if by_project.empty?

    ActiveRecord::Base.transaction do
      invoice = Invoice.create!(
        client: @client,
        contact: @contact,
        status: "pending",
        start_date: @start_date,
        end_date: @end_date
      )

      by_project.each do |project_id, entries|
        project = project_id && Project.find(project_id)

        if project.nil?
          bill_hourly(invoice, entries, project: nil)
        elsif project.fixed_price?
          bill_fixed_price(invoice, entries, project)
        elsif project.capped?
          # A client invoice bundles every one of the client's projects together — one capped
          # project having already exhausted its cap shouldn't block billing everything else
          # that's ready to go. Skip just this project (its entries stay unbilled) and surface it
          # as a warning instead of aborting the whole invoice.
          begin
            bill_capped(invoice, entries, project)
          rescue ArgumentError => e
            @warnings << e.message
          end
        else
          bill_hourly(invoice, entries, project: project)
        end
      end

      # A `return` here would silently commit the surrounding transaction (Rails treats a
      # non-local return from inside a transaction block as normal completion, not a rollback) —
      # raising ActiveRecord::Rollback is the only way to bail out and have `transaction` itself
      # yield nil for an invoice that ended up with no billable lines (e.g. every group was an
      # already-billed fixed-price project skipping a no-op re-generation).
      raise ActiveRecord::Rollback if invoice.invoice_line_items.empty?

      invoice.recalculate_total!
      invoice
    end
  end

  private

  # --- Billing strategies, one per Project::BILLING_MODES value ------------------------------

  def bill_hourly(invoice, entries, project:)
    entries.each do |entry|
      rate = effective_rate(entry)
      InvoiceLineItem.create!(
        invoice: invoice,
        time_entry: entry,
        project: project,
        task: entry.task,
        kind: "time",
        description: build_description(entry),
        hours: entry.hours,
        rate: rate,
        amount: entry.hours * rate,
        tax_rate: @tax_rate
      )
    end
    consume!(entries, invoice)
  end

  # Bills the project's full agreed amount exactly once, ever — regardless of how much time (if
  # any) has been logged. Once any line item exists for this project it's considered billed, so
  # generating again for this project is a no-op (skip, don't re-bill).
  def bill_fixed_price(invoice, entries, project)
    return if InvoiceLineItem.where(project: project).exists?

    if project.show_task_breakdown
      nominal_total = 0
      project.estimated_tasks.each do |task|
        rate  = effective_project_rate(project)
        hours = task.estimated_hours
        amount = hours * rate
        nominal_total += amount
        InvoiceLineItem.create!(
          invoice: invoice,
          project: project,
          task: task,
          kind: "time",
          description: "#{task.task_group.title} · #{task.title}",
          hours: hours,
          rate: rate,
          amount: amount,
          tax_rate: @tax_rate
        )
      end

      adjustment = project.billing_amount - nominal_total
      # Skip the line entirely when the tasks' nominal total already lands exactly on the fixed
      # price — nothing to true up, so there's nothing useful to show the client.
      if adjustment.round(2) != 0
        InvoiceLineItem.create!(
          invoice: invoice,
          project: project,
          kind: "adjustment",
          description: "Fixed price adjustment",
          hours: 0,
          rate: 0,
          amount: adjustment,
          tax_rate: @tax_rate
        )
      end
    else
      InvoiceLineItem.create!(
        invoice: invoice,
        project: project,
        kind: "fixed",
        description: "#{project.name} · Fixed price",
        hours: 0,
        rate: 0,
        amount: project.billing_amount,
        tax_rate: @tax_rate
      )
    end

    consume!(entries, invoice)
  end

  # Bills actual hours as usual, but never lets the pre-tax subtotal for this project exceed its
  # agreed cap. Overage is written off with a negative adjustment line (consumed, not rolled to a
  # future invoice); once the cap is fully used, raises instead of producing a $0 invoice.
  def bill_capped(invoice, entries, project)
    already = InvoiceLineItem.where(project: project).sum(:amount)
    room = project.billing_amount - already
    raise ArgumentError, "#{project.name} has already reached its billing cap" if room <= 0

    lines = entries.map do |entry|
      rate = effective_rate(entry)
      {
        invoice: invoice,
        time_entry: entry,
        project: project,
        task: entry.task,
        kind: "time",
        description: build_description(entry),
        hours: entry.hours,
        rate: rate,
        amount: entry.hours * rate,
        tax_rate: @tax_rate
      }
    end

    group_total = lines.sum { |l| l[:amount] }
    lines.each { |l| InvoiceLineItem.create!(l) }

    if group_total > room
      InvoiceLineItem.create!(
        invoice: invoice,
        project: project,
        kind: "adjustment",
        description: "Billing cap adjustment",
        hours: 0,
        rate: 0,
        amount: -(group_total - room),
        tax_rate: @tax_rate
      )
    end

    consume!(entries, invoice)
  end

  def consume!(entries, invoice)
    TimeEntry.where(id: entries.map(&:id)).update_all(invoice_id: invoice.id) if entries.any?
  end

  def unbilled_fixed_price_projects(already_grouped_ids)
    @client.projects
           .where(billing_mode: "fixed_price")
           .where.not(id: already_grouped_ids)
           .reject { |p| InvoiceLineItem.where(project: p).exists? }
  end

  # --- Entry resolution (unchanged) -----------------------------------------------------------

  def sort_entries(entries)
    entries.sort_by do |e|
      [
        e.task&.task_group&.position || Float::INFINITY,
        e.task&.position             || Float::INFINITY,
        e.date
      ]
    end
  end

  def specific_entries
    entries = TimeEntry.where(id: @time_entry_ids)
                       .includes({ task: :task_group }, :charge_code, { project: :rates })
    already_billed = entries.select { |e| e.invoice_id.present? }
    raise ArgumentError, "Some entries are already billed" if already_billed.any?
    entries
  end

  def unbilled_entries
    scope = TimeEntry
      .left_outer_joins(:project)
      .where(invoice_id: nil)
      .where(
        "(time_entries.project_id IS NOT NULL AND projects.client_id = :cid) OR " \
        "(time_entries.charge_code_id IS NOT NULL AND time_entries.client_id = :cid)",
        cid: @client.id
      )
      .includes({ task: :task_group }, :charge_code, { project: :rates })

    scope = scope.where("time_entries.date >= ?", @start_date) if @start_date.present?
    scope = scope.where("time_entries.date <= ?", @end_date) if @end_date.present?
    scope
  end

  def build_description(entry)
    if entry.charge_code_id.present?
      parts = [entry.charge_code.code, entry.description.presence].compact
    else
      parts = [
        entry.task&.task_group&.title.presence,
        entry.task&.title.presence,
        entry.description.presence
      ].compact
    end
    parts.join(" · ")
  end

  def effective_rate(entry)
    if entry.charge_code_id.present?
      entry.charge_code.rate || @client.rates.first&.rate || 0
    else
      entry.project.rates.first&.rate || @client.rates.first&.rate || 0
    end
  end

  def effective_project_rate(project)
    project.rates.first&.rate || @client.rates.first&.rate || 0
  end
end
