require "test_helper"

class InvoiceLineItemTest < ActiveSupport::TestCase
  def build_invoice
    bp = BusinessProfile.create!(user: nil, name: "Business")
    client = bp.clients.create!(name: "Client")
    contact = client.contacts.create!(name: "Contact", primary: true)
    Invoice.create!(client: client, contact: contact, status: "pending")
  end

  test "a custom line with no hours/rate/amount is valid (a plain text row)" do
    invoice = build_invoice
    item = InvoiceLineItem.new(invoice: invoice, kind: "custom", description: "Phase 1: Design")

    assert item.valid?
    item.save!
    assert_nil item.hours
    assert_nil item.rate
    assert_nil item.amount
  end

  test "a custom line's amount stays nil after save, not coerced to 0" do
    invoice = build_invoice
    item = InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Section label")

    assert_nil item.reload.amount
    assert item.text_only?
  end

  test "a custom line with an explicit amount is not text-only" do
    invoice = build_invoice
    item = InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 1", amount: 2500)

    assert_equal 2500, item.amount
    assert_not item.text_only?
  end

  test "non-custom kinds still default hours/rate/amount to 0 rather than leaving them nil" do
    invoice = build_invoice
    item = InvoiceLineItem.create!(invoice: invoice, kind: "fixed", description: "Fixed price", amount: 5000)

    assert_equal 0, item.hours
    assert_equal 0, item.rate
    assert item.valid?
  end

  test "an invalid kind is rejected" do
    invoice = build_invoice
    item = InvoiceLineItem.new(invoice: invoice, kind: "bogus", description: "x", hours: 1, rate: 1, amount: 1)

    assert_not item.valid?
  end
end
