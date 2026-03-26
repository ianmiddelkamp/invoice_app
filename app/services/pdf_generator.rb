class PdfGenerator
  include PdfRenderer

  def initialize(invoice)
    @invoice  = invoice
    @client   = invoice.client
    @business = BusinessProfile.instance
    @items    = invoice.invoice_line_items
                       .includes(time_entry: [:project, :task])
                       .order("time_entries.date ASC")
  end

  def generate
    html = ActionController::Base.render(
      template: "pdfs/invoice",
      layout: "pdf",
      assigns: {
        invoice: @invoice,
        client: @client,
        business: @business,
        items: @items,
        logo_data_uri: @business.logo_data_uri
      }
    )
    render_to_pdf(html)
  end
end
