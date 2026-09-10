class PdfGenerator
  include PdfRenderer

  def initialize(invoice)
    @invoice  = invoice
    @client   = invoice.client
    @contact  = invoice.contact
    @business = @client.business_profile
    # Ordered by position (custom invoices), falling back to id for generator-created lines
    # (position always nil there) — not time_entry.date, since fixed/adjustment/custom lines
    # have no time_entry to sort by. This explicit .order is scoped to this one query only,
    # deliberately not a default scope on the association — a default order there breaks
    # unrelated aggregate queries elsewhere (.distinct.pluck, .group.count) that go through the
    # same association.
    @items    = invoice.invoice_line_items
                       .includes(time_entry: [:project, :charge_code, :task], project: [], task: :task_group)
                       .order(Arel.sql("position IS NULL, position, id"))
  end

  def generate
    html = ActionController::Base.render(
      template: "pdfs/invoice",
      layout: "pdf",
      assigns: {
        invoice: @invoice,
        client: @client,
        contact: @contact,
        business: @business,
        items: @items,
        logo_data_uri: @business.logo_data_uri
      }
    )
    render_to_pdf(html)
  end
end
