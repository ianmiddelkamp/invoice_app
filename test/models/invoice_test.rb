require "test_helper"

class InvoiceTest < ActiveSupport::TestCase
  def build_invoice(tax_rate: 0)
    bp = BusinessProfile.create!(user: nil, name: "Business", tax_rate: tax_rate)
    client = bp.clients.create!(name: "Client")
    contact = client.contacts.create!(name: "Contact", primary: true)
    Invoice.create!(client: client, contact: contact, status: "pending")
  end

  test "recalculate_total! sums amounts and tax across line items" do
    invoice = build_invoice(tax_rate: 13)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "A", amount: 100, tax_rate: 13)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "B", amount: 200, tax_rate: 13)

    invoice.recalculate_total!

    assert_equal 339, invoice.total # 300 + 13% of 300
  end

  test "recalculate_total! ignores a text-only line's nil amount instead of raising" do
    invoice = build_invoice
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Section header")
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Billable", amount: 500)

    invoice.recalculate_total!

    assert_equal 500, invoice.total
  end

  test "recalculate_total! on an invoice with zero line items totals to 0" do
    invoice = build_invoice

    invoice.recalculate_total!

    assert_equal 0, invoice.total
  end
end
