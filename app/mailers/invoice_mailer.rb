class InvoiceMailer < ApplicationMailer
  def invoice_email(invoice)
    @invoice  = invoice
    @client   = invoice.client
    @business = BusinessProfile.instance
    @items    = invoice.invoice_line_items.includes(time_entry: :project).order("time_entries.date ASC")

    attachments["#{@invoice.number}.pdf"] = {
      mime_type: "application/pdf",
      content: @invoice.pdf.download
    }

    mail(
      to:      @client.email1,
      subject: "Invoice #{invoice.number} from #{@business.name.presence || 'us'}"
    )
  end
end
