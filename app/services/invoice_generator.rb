class InvoiceGenerator
  def initialize(client:)
    @client = client
  end

  def generate!
    # Grab unbilled time entries for this client
    time_entries = TimeEntry.joins(:project)
                        .left_outer_joins(:invoice_line_item)
                        .where(projects: { client_id: @client.id })
                        .where(invoice_line_items: { id: nil })

    return nil if time_entries.empty?

    invoice = Invoice.create!(client: @client, status: "pending")

    time_entries.each do |entry|
      InvoiceLineItem.create!(
        invoice: invoice,
        time_entry: entry,
        hours: entry.hours,
        rate: entry.project.rates.first&.rate || 0,
        amount: entry.hours * (entry.project.rates.first&.rate || 0)
      )
    end

    invoice
  end
end