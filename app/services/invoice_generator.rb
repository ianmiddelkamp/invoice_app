class InvoiceGenerator
  def initialize(client:, start_date: nil, end_date: nil, time_entry_ids: nil)
    @client          = client
    @start_date      = start_date
    @end_date        = end_date
    @time_entry_ids  = time_entry_ids
    @tax_rate        = BusinessProfile.instance.tax_rate || 0
  end

  def generate!
    time_entries = @time_entry_ids.present? ? specific_entries : unbilled_entries
    return nil if time_entries.empty?

    ActiveRecord::Base.transaction do
      invoice = Invoice.create!(
        client: @client,
        status: "pending",
        start_date: @start_date,
        end_date: @end_date
      )

      time_entries.each do |entry|
        rate = effective_rate(entry)
        InvoiceLineItem.create!(
          invoice: invoice,
          time_entry: entry,
          description: build_description(entry),
          hours: entry.hours,
          rate: rate,
          amount: entry.hours * rate,
          tax_rate: @tax_rate
        )
      end

      items    = invoice.invoice_line_items.reload
      subtotal = items.sum(:amount)
      tax      = items.sum { |i| i.amount * i.tax_rate / 100 }
      invoice.update!(total: subtotal + tax)
      invoice
    end
  end

  private

  def specific_entries
    entries = TimeEntry.where(id: @time_entry_ids)
                       .includes(:task, :charge_code, invoice_line_item: {}, project: :rates)
    already_billed = entries.select { |e| e.invoice_line_item.present? }
    raise ArgumentError, "Some entries are already billed" if already_billed.any?
    entries
  end

  def unbilled_entries
    scope = TimeEntry
      .left_outer_joins(:invoice_line_item, :project)
      .where(invoice_line_items: { id: nil })
      .where(
        "(time_entries.project_id IS NOT NULL AND projects.client_id = :cid) OR " \
        "(time_entries.charge_code_id IS NOT NULL AND time_entries.client_id = :cid)",
        cid: @client.id
      )
      .includes(:task, :charge_code, project: :rates)

    scope = scope.where("time_entries.date >= ?", @start_date) if @start_date.present?
    scope = scope.where("time_entries.date <= ?", @end_date) if @end_date.present?
    scope
  end

  def build_description(entry)
    if entry.charge_code_id.present?
      parts = [entry.charge_code.code, entry.description.presence].compact
    else
      parts = [entry.description.presence, entry.task&.title.presence].compact
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
end
