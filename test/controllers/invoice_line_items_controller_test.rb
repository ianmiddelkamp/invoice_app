require "test_helper"

class InvoiceLineItemsControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user)
    token = JsonWebToken.encode(user_id: user.id)
    { "Authorization" => "Bearer #{token}" }
  end

  def setup
    @bp = BusinessProfile.for_user(users(:admin))
    @client = @bp.clients.create!(name: "Client")
    @primary = @client.contacts.create!(name: "Primary", primary: true)
    @project = @client.projects.create!(name: "Project", billing_mode: "fixed_price", billing_amount: 5000)
    @invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
  end

  test "create builds a custom line item and recalculates the invoice total" do
    post "/invoices/#{@invoice.id}/line_items",
      params: { invoice_line_item: { description: "Milestone 1", amount: 2500 } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "Milestone 1", body["description"]
    assert_equal 2500.0, body["amount"]
    assert_equal 2500, @invoice.reload.total
  end

  test "create allows a text-only line with no amount" do
    post "/invoices/#{@invoice.id}/line_items",
      params: { invoice_line_item: { description: "Phase 1: Design" } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :created
    body = JSON.parse(response.body)
    assert_nil body["amount"]
  end

  test "create surfaces the fixed-price overage warning" do
    post "/invoices/#{@invoice.id}/line_items",
      params: { invoice_line_item: { description: "Milestone 1", amount: 6000, project_id: @project.id } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal 1, body["warnings"].size
    assert_includes body["warnings"].first, "1000"
  end

  test "update changes fields and recalculates the total" do
    item = InvoiceLineItem.create!(invoice: @invoice, kind: "custom", description: "Milestone 1", amount: 2500)

    patch "/invoices/#{@invoice.id}/line_items/#{item.id}",
      params: { invoice_line_item: { amount: 3000 } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :success
    assert_equal 3000, @invoice.reload.total
  end

  test "destroy removes the line item and recalculates the total" do
    item = InvoiceLineItem.create!(invoice: @invoice, kind: "custom", description: "Milestone 1", amount: 2500)
    @invoice.recalculate_total!

    delete "/invoices/#{@invoice.id}/line_items/#{item.id}", headers: auth_headers(users(:admin))

    assert_response :no_content
    assert_equal 0, @invoice.reload.total
    assert_not InvoiceLineItem.exists?(item.id)
  end

  test "cannot touch a line item on another business's invoice" do
    other_bp = BusinessProfile.create!(user: nil, name: "Other")
    other_client = other_bp.clients.create!(name: "Other Client")
    other_contact = other_client.contacts.create!(name: "Contact", primary: true)
    other_invoice = Invoice.create!(client: other_client, contact: other_contact, status: "pending")

    post "/invoices/#{other_invoice.id}/line_items",
      params: { invoice_line_item: { description: "x" } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :not_found
  end
end
