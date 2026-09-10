class InvoicesController < ApplicationController
  before_action :set_invoice, only: [:show, :update, :destroy, :pdf, :regenerate_pdf, :send_invoice, :mark_as_paid, :send_receipt, :attach_time_entries, :detach_time_entries, :time_entries]

  def index
    invoices = current_business_profile.invoices.includes(:client).order(created_at: :desc)
    render json: invoices.as_json(include: :client, methods: [:number, :outstanding])
  end

  # GET /invoices/export?format=csv|xlsx|md
  # TODO: replace with the business's own configured timezone once BusinessProfile supports one.
  EXPORT_TIME_ZONE = "Eastern Time (US & Canada)"

  def export
    invoices = current_business_profile.invoices.includes(:client).order(created_at: :desc)
    headers = ["Invoice #", "Client", "Period", "Total", "Status", "Outstanding", "Payment Date"]
    rows = invoices.map do |inv|
      period = if inv.start_date && inv.end_date
        "#{inv.start_date} - #{inv.end_date}"
      else
        inv.start_date.to_s
      end
      paid_date = inv.paid_at&.in_time_zone(EXPORT_TIME_ZONE)&.to_date&.to_s
      [inv.number, inv.client&.name, period, inv.total, inv.status, inv.outstanding, paid_date]
    end

    case params[:format]
    when "csv"
      send_data TableExport.csv(headers, rows), filename: "invoices.csv", type: "text/csv"
    when "xlsx"
      send_data TableExport.xlsx("Invoices", headers, rows), filename: "invoices.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when "md"
      send_data TableExport.markdown("Invoices", headers, rows), filename: "invoices.md", type: "text/markdown"
    else
      render json: { error: "Unsupported format" }, status: :unprocessable_entity
    end
  end

  def show
    render json: invoice_json(@invoice)
  end

  def unbilled_entries
    client = current_business_profile.clients.find(params[:client_id])

    scope = TimeEntry
      .left_outer_joins(:project)
      .where(invoice_id: nil)
      .where(
        "(time_entries.project_id IS NOT NULL AND projects.client_id = :cid) OR " \
        "(time_entries.charge_code_id IS NOT NULL AND time_entries.client_id = :cid)",
        cid: client.id
      )
      .includes({ task: :task_group }, :charge_code, project: {})

    scope = scope.where("time_entries.date >= ?", params[:start_date]) if params[:start_date].present?
    scope = scope.where("time_entries.date <= ?", params[:end_date]) if params[:end_date].present?

    render json: scope.order("time_entries.date desc").as_json(
      include: {
        # task_group's title is needed so the custom invoice creator's attach-time-entries
        # preview can build the exact same "Group · Task · description" text that attaching a
        # single entry will actually save (TimeEntry#billing_description) — without it, the
        # preview showed a different, shorter description than what appeared after the real
        # attach happened.
        task: { only: %i[id title], include: { task_group: { only: %i[id title] } } },
        project: { only: %i[id name] },
        charge_code: { only: %i[id code description] }
      }
    )
  end

  # A custom invoice is built entirely by hand afterward via the nested line_items endpoints
  # (InvoiceLineItemsController) — no InvoiceGenerator run, no time entries required up front.
  def create
    client = current_business_profile.clients.find(params[:client_id])
    contact = resolve_contact(client, params[:contact_id])

    if params[:custom].present?
      invoice = Invoice.create!(
        client: client,
        contact: contact,
        status: "pending",
        start_date: params[:start_date],
        end_date: params[:end_date]
      )
      render json: invoice_json(invoice), status: :created
      return
    end

    generator = InvoiceGenerator.new(
      client: client,
      contact: contact,
      start_date: params[:start_date],
      end_date: params[:end_date],
      time_entry_ids: params[:time_entry_ids]
    )

    begin
      invoice = generator.generate!
    rescue ArgumentError => e
      render json: { error: e.message }, status: :unprocessable_entity
      return
    end

    if invoice.nil?
      # generator.warnings can be non-empty here too — e.g. the only project with unbilled work
      # was a capped project that had already exhausted its cap, so there's nothing left to bill.
      message = generator.warnings.presence&.join(" ") ||
        "No unbilled time entries found for this client in the selected period."
      render json: { error: message }, status: :unprocessable_entity
      return
    end

    regenerate_invoice_pdf!(invoice)

    warnings = generator.warnings + fixed_price_quote_warnings(invoice)
    render json: invoice_json(invoice).merge(warnings: warnings), status: :created
  end

  def update
    attrs = invoice_params.to_h
    contact_changing = attrs.key?("contact_id") && attrs["contact_id"].to_i != @invoice.contact_id
    if attrs.key?("contact_id")
      contact = current_business_profile.contacts.find_by(id: attrs["contact_id"])
      unless contact && contact.client_id == @invoice.client_id
        render json: { errors: ["Contact must belong to this invoice's client."] }, status: :unprocessable_entity
        return
      end
    end

    if @invoice.update(invoice_params)
      # The "Bill To" contact is shown as part of the document preview even though it's only
      # metadata on the record — regenerating here means what's displayed always matches what's
      # actually stored/attached, so there's never a stale PDF with the old contact's info still
      # printed on it after an edit.
      regenerate_invoice_pdf!(@invoice) if contact_changing && @invoice.pdf.attached?
      render json: invoice_json(@invoice)
    else
      render json: { errors: @invoice.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @invoice.status == "paid"
      render json: { error: "Paid invoices cannot be deleted." }, status: :unprocessable_entity
      return
    end

    @invoice.destroy
    head :no_content
  end

  def send_invoice
    contact = resolve_send_contact(@invoice)
    return unless contact

    unless @invoice.pdf.attached?
      render json: { error: "No PDF found. Please regenerate the PDF first." }, status: :unprocessable_entity
      return
    end

    InvoiceMailer.invoice_email(@invoice, contact).deliver_now
    render json: { message: "Invoice sent to #{contact.email}." }
  end

  def send_receipt
    contact = resolve_send_contact(@invoice)
    return unless contact

    unless @invoice.pdf.attached?
      render json: { error: "No PDF found. Please regenerate the PDF first." }, status: :unprocessable_entity
      return
    end

    InvoiceMailer.receipt_email(@invoice, contact).deliver_now
    render json: { message: "Receipt sent to #{contact.email}." }
  end
  def regenerate_pdf
    regenerate_invoice_pdf!(@invoice)
    render json: { message: "PDF regenerated successfully" }
  end

  def pdf
    unless @invoice.pdf.attached?
      render json: { error: "PDF not available" }, status: :not_found
      return
    end

    send_data @invoice.pdf.download,
      filename: "#{@invoice.number}.pdf",
      type: "application/pdf",
      disposition: "attachment"
  end

  # Marks a set of the invoice's client's unbilled time entries as billed against this invoice —
  # used by the custom invoice creator so a hand-typed line's hours can be calculated from real
  # logged work. Independent of any specific line item: nothing tracks which entries fed which
  # line's hours after the fact, same as if the hours had been typed by hand — EXCEPT when
  # exactly one entry is attached with a line_item_id: that one case has an unambiguous 1:1
  # mapping, so the target line is converted into a real "time" kind line backed by that entry,
  # the same shape InvoiceGenerator itself would have created.
  def attach_time_entries
    ids = Array(params[:time_entry_ids])
    entries = TimeEntry.where(id: ids).includes(:project, :charge_code, :task)

    tenant_mismatch = entries.any? { |e| (e.project&.client_id || e.client_id) != @invoice.client_id }
    if tenant_mismatch || entries.size != ids.size
      render json: { error: "Some time entries don't belong to this invoice's client." }, status: :unprocessable_entity
      return
    end

    if entries.any? { |e| e.invoice_id.present? }
      render json: { error: "Some entries are already billed" }, status: :unprocessable_entity
      return
    end

    TimeEntry.where(id: entries.map(&:id)).update_all(invoice_id: @invoice.id)

    if params[:line_item_id].present? && entries.size == 1
      line_item = @invoice.invoice_line_items.find(params[:line_item_id])
      entry = entries.first
      rate = entry.effective_rate
      line_item.update!(
        kind: "time", time_entry: entry, project: entry.project, task: entry.task,
        # Only fall back to the entry's own description when the line doesn't already have one —
        # a description the user already typed (or the draft preview already filled in) must
        # survive this conversion, not get silently overwritten by it.
        description: line_item.description.presence || entry.billing_description,
        hours: entry.hours, rate: rate,
        amount: entry.hours * rate, tax_rate: @invoice.client.business_profile.tax_rate || 0
      )
      @invoice.recalculate_total!
    end

    render json: { message: "Attached #{entries.size} time #{'entry'.pluralize(entries.size)}." }
  end

  # Not part of the normal invoice payload — every invoice show/create/update would otherwise pay
  # for this query even though only the custom invoice creator ever needs it. Loaded async by
  # that page after the invoice itself.
  def time_entries
    render json: attached_time_entries_json(@invoice)
  end

  # Unbills the given time entries (only those currently attached to this invoice). If any of
  # them was the sole entry behind a converted "time" kind custom line (see attach_time_entries
  # above), that line is deleted along with it — it has no meaning once its one real entry is
  # gone. Lines whose hours were only ever a one-time calculated sum of several entries are left
  # untouched, per the custom invoice creator's design: that calculation was never a lasting link.
  def detach_time_entries
    ids = Array(params[:time_entry_ids])
    entries = @invoice.time_entries.where(id: ids)

    @invoice.invoice_line_items.where(kind: "time", time_entry_id: entries.map(&:id)).destroy_all
    TimeEntry.where(id: entries.map(&:id)).update_all(invoice_id: nil)
    @invoice.recalculate_total!

    render json: invoice_json(@invoice).merge(time_entries: attached_time_entries_json(@invoice))
  end

  def mark_as_paid
    unless @invoice.paid_at.nil?
      render json: { error: "Invoice already paid" }, status: :method_not_allowed
      return
    end


    if @invoice.update({ status: "paid", paid_at: Time.current }.merge(paid_params))
      render json: invoice_json(@invoice)
    else
      render json: { errors: @invoice.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_invoice
    @invoice = current_business_profile.invoices.includes(:contact).find(params[:id])
  end

  def regenerate_invoice_pdf!(invoice)
    pdf_data = PdfGenerator.new(invoice).generate
    invoice.pdf.attach(
      io: StringIO.new(pdf_data),
      filename: "#{invoice.number}.pdf",
      content_type: "application/pdf"
    )
  end

  # Informational only — never blocks or alters the invoice. Surfaces when a just-generated
  # Fixed Price invoice billed a different task breakdown than what the client actually saw in
  # the project's most recently accepted (or most recent) estimate. See
  # Project#fixed_price_quote_drift for why the total itself never needs this kind of check.
  def fixed_price_quote_warnings(invoice)
    project_ids = invoice.invoice_line_items.where.not(project_id: nil).distinct.pluck(:project_id)
    Project.where(id: project_ids, billing_mode: "fixed_price").filter_map do |project|
      drift = project.fixed_price_quote_drift
      next unless drift

      parts = []
      parts << "added: #{drift[:added].join(', ')}" if drift[:added].any?
      parts << "removed: #{drift[:removed].join(', ')}" if drift[:removed].any?
      parts << "changed: #{drift[:changed].join(', ')}" if drift[:changed].any?
      "#{project.name} was billed with a different task breakdown than quoted in #{drift[:reference]} (#{parts.join('; ')})"
    end
  end

  # Defaults to the client's primary contact when none is given; raises RecordNotFound (rendered
  # as a 404 by ApplicationController, matching every other tenant-scoped .find in this app) if a
  # contact_id is given but doesn't belong to this client.
  def resolve_contact(client, contact_id)
    return client.primary_contact if contact_id.blank?
    current_business_profile.contacts.where(client: client).find(contact_id)
  end

  # Shared by send_invoice/send_receipt: resolves an optional per-send contact_id override,
  # falling back to the invoice's stored contact, and renders the appropriate error (returning
  # nil) if the resolved contact is invalid or has no email — callers check the return value.
  def resolve_send_contact(invoice)
    contact = if params[:contact_id].present?
      current_business_profile.contacts.find_by(id: params[:contact_id])
    else
      invoice.contact
    end

    unless contact && contact.client_id == invoice.client_id
      render json: { error: "Contact must belong to this invoice's client." }, status: :unprocessable_entity
      return nil
    end

    unless contact.email.present?
      render json: { error: "Contact has no email address on file." }, status: :unprocessable_entity
      return nil
    end

    contact
  end

  def invoice_params
    params.require(:invoice).permit(:status, :contact_id)
  end

  def attached_time_entries_json(invoice)
    invoice.time_entries.includes(:task, :project, :charge_code).as_json(
      only: %i[id date hours description],
      include: {
        task: { only: %i[id title] },
        project: { only: %i[id name] },
        charge_code: { only: %i[id code] }
      }
    )
  end

  def invoice_json(invoice)
    invoice.as_json(
      methods: :number,
      include: {
        client: { include: { contacts: { only: %i[id name email phone phone2 primary] } } },
        contact: { only: %i[id name email phone phone2 primary] },
        invoice_line_items: {
          include: {
            time_entry: {
              include: [
                :project, :charge_code,
                { task: { only: %i[id title], include: { task_group: { only: %i[id title position] } } } }
              ]
            },
            project: { only: %i[id name show_task_breakdown show_hours] },
            task: { only: %i[id title], include: { task_group: { only: %i[id title position] } } }
          }
        }
      }
    )
  end

   def paid_params
    params.require(:payment).permit(:paid_at, :amount_paid)
  end
end
