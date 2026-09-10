require "test_helper"

class ProjectFixedPriceOverageWarningTest < ActiveSupport::TestCase
  def build_project(billing_mode: "fixed_price", billing_amount: 5000)
    bp = BusinessProfile.create!(user: nil, name: "Business")
    client = bp.clients.create!(name: "Client")
    Project.create!(client: client, name: "Project", billing_mode: billing_mode, billing_amount: billing_amount)
  end

  def build_invoice(project)
    contact = project.client.contacts.create!(name: "Contact", primary: true)
    Invoice.create!(client: project.client, contact: contact, status: "pending")
  end

  test "nil for a non-fixed-price project" do
    project = build_project(billing_mode: "hourly", billing_amount: nil)
    assert_nil project.fixed_price_overage_warning
  end

  test "nil when nothing has been billed yet" do
    project = build_project
    assert_nil project.fixed_price_overage_warning
  end

  test "nil when custom invoices total exactly the fixed price" do
    project = build_project(billing_amount: 5000)
    invoice = build_invoice(project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 1", amount: 2500, project: project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 2", amount: 2500, project: project)

    assert_nil project.fixed_price_overage_warning
  end

  test "present when custom invoices sum to more than the fixed price" do
    project = build_project(billing_amount: 5000)
    invoice = build_invoice(project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 1", amount: 3000, project: project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 2", amount: 3000, project: project)

    warning = project.fixed_price_overage_warning
    assert_not_nil warning
    assert_includes warning, "1000"
  end

  test "a text-only line's nil amount doesn't break the sum" do
    project = build_project(billing_amount: 5000)
    invoice = build_invoice(project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Section header", project: project)
    InvoiceLineItem.create!(invoice: invoice, kind: "custom", description: "Milestone 1", amount: 3000, project: project)

    assert_nil project.fixed_price_overage_warning
  end
end
