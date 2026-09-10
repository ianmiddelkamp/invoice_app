require "test_helper"

class InvoicesControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user)
    token = JsonWebToken.encode(user_id: user.id)
    { "Authorization" => "Bearer #{token}" }
  end

  def setup
    @bp = BusinessProfile.for_user(users(:admin))
    @client = @bp.clients.create!(name: "Client")
    @primary = @client.contacts.create!(name: "Primary", email: "primary@example.com", primary: true)
    @project = Project.create!(client: @client, name: "Project")
    TimeEntry.create!(user: users(:admin), project: @project, date: Date.current, hours: 2)
  end

  test "create defaults to the client's primary contact when none is given" do
    stub_pdf_rendering do
      post "/invoices", params: { client_id: @client.id }, headers: auth_headers(users(:admin))
    end
    assert_response :created

    body = JSON.parse(response.body)
    assert_equal @primary.id, body["contact"]["id"]
  end

  test "create rejects a contact belonging to a different client" do
    other_client = @bp.clients.create!(name: "Other Client")
    other_contact = other_client.contacts.create!(name: "Other", primary: true)

    post "/invoices", params: { client_id: @client.id, contact_id: other_contact.id }, headers: auth_headers(users(:admin))
    assert_response :not_found
  end

  test "update can change the stored contact" do
    secondary = @client.contacts.create!(name: "Secondary")
    invoice = InvoiceGenerator.new(client: @client, contact: @primary).generate!

    patch "/invoices/#{invoice.id}",
      params: { invoice: { contact_id: secondary.id } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    assert_response :success

    assert_equal secondary, invoice.reload.contact
  end

  test "update regenerates the attached PDF when the contact changes, so it never goes stale" do
    secondary = @client.contacts.create!(name: "Secondary")
    invoice = InvoiceGenerator.new(client: @client, contact: @primary).generate!
    invoice.pdf.attach(io: StringIO.new("stale pdf content"), filename: "i.pdf", content_type: "application/pdf")

    stub_pdf_rendering do
      patch "/invoices/#{invoice.id}",
        params: { invoice: { contact_id: secondary.id } }.to_json,
        headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    end
    assert_response :success

    assert_equal "%PDF-1.4 fake pdf content", invoice.reload.pdf.download
  end

  test "update does NOT regenerate the PDF when the contact isn't changing (e.g. a status-only update)" do
    invoice = InvoiceGenerator.new(client: @client, contact: @primary).generate!
    invoice.pdf.attach(io: StringIO.new("original pdf content"), filename: "i.pdf", content_type: "application/pdf")

    patch "/invoices/#{invoice.id}",
      params: { invoice: { status: "sent" } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    assert_response :success

    assert_equal "original pdf content", invoice.reload.pdf.download
  end

  test "update rejects a contact belonging to a different client" do
    invoice = InvoiceGenerator.new(client: @client, contact: @primary).generate!
    other_client = @bp.clients.create!(name: "Other Client")
    other_contact = other_client.contacts.create!(name: "Other", primary: true)

    patch "/invoices/#{invoice.id}",
      params: { invoice: { contact_id: other_contact.id } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    assert_response :unprocessable_entity
    assert_equal @primary, invoice.reload.contact
  end

  test "send-time contact override doesn't mutate the invoice's stored contact" do
    secondary = @client.contacts.create!(name: "Secondary", email: "secondary@example.com")
    invoice = InvoiceGenerator.new(client: @client, contact: @primary).generate!
    invoice.pdf.attach(io: StringIO.new("fake pdf"), filename: "i.pdf", content_type: "application/pdf")

    post "/invoices/#{invoice.id}/send_invoice",
      params: { contact_id: secondary.id }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    assert_response :success

    body = JSON.parse(response.body)
    assert_includes body["message"], secondary.email
    assert_equal @primary, invoice.reload.contact
  end

  test "export returns csv, xlsx, and md for supported formats" do
    InvoiceGenerator.new(client: @client, contact: @primary).generate!

    get "/invoices/export", params: { format: "csv" }, headers: auth_headers(users(:admin))
    assert_response :success
    assert_includes response.body, @client.name

    get "/invoices/export", params: { format: "xlsx" }, headers: auth_headers(users(:admin))
    assert_response :success

    get "/invoices/export", params: { format: "md" }, headers: auth_headers(users(:admin))
    assert_response :success
    assert_includes response.body, "# Invoices"
  end

  test "export rejects an unsupported format" do
    get "/invoices/export", params: { format: "pdf" }, headers: auth_headers(users(:admin))
    assert_response :unprocessable_entity
  end

  test "create skips just the exhausted capped project and warns, billing the rest of the client normally" do
    capped_project = @client.projects.create!(name: "Capped", billing_mode: "capped", billing_amount: 100)
    capped_project.rates.create!(rate: 100)
    capped_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 1)
    # This first generate! also consumes @project's stray entry from setup, so it's billed and
    # gone before the real test invoice — a fresh entry is needed after exhausting the cap.
    InvoiceGenerator.new(client: @client, contact: @primary).generate!
    capped_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 1)
    @project.rates.create!(rate: 50)
    TimeEntry.create!(user: users(:admin), project: @project, date: Date.current, hours: 2)

    stub_pdf_rendering do
      post "/invoices", params: { client_id: @client.id }, headers: auth_headers(users(:admin))
    end

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal 100, body["total"] # just @project's 2h * $50 — capped skipped
    assert_equal 1, body["warnings"].size
    assert_includes body["warnings"].first, "billing cap"
  end

  test "create returns 422 with a clear message when a capped project's exhausted cap is the only unbilled work" do
    client = @bp.clients.create!(name: "Capped-Only Client")
    contact = client.contacts.create!(name: "Primary", primary: true)
    capped_project = client.projects.create!(name: "Capped", billing_mode: "capped", billing_amount: 100)
    capped_project.rates.create!(rate: 100)
    capped_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 1)
    InvoiceGenerator.new(client: client, contact: contact).generate!
    capped_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 1)

    post "/invoices", params: { client_id: client.id }, headers: auth_headers(users(:admin))

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_includes body["error"], "billing cap"
  end

  test "create surfaces a warning when a fixed-price project's billed breakdown drifted from its quote" do
    project = @client.projects.create!(name: "Fixed", billing_mode: "fixed_price", billing_amount: 5000)
    project.rates.create!(rate: 100)
    task = project.task_groups.create!(title: "Phase 1").tasks.create!(title: "Design", status: "todo", estimated_hours: 10)
    EstimateGenerator.new(project: project, contact: @primary).generate!
    task.update!(estimated_hours: 20)

    stub_pdf_rendering do
      post "/invoices", params: { client_id: @client.id }, headers: auth_headers(users(:admin))
    end
    assert_response :created

    body = JSON.parse(response.body)
    assert_equal 1, body["warnings"].size
    assert_includes body["warnings"].first, "Design"
  end

  test "create returns no warnings when a fixed-price project's billed breakdown matches its quote" do
    project = @client.projects.create!(name: "Fixed", billing_mode: "fixed_price", billing_amount: 5000)
    project.rates.create!(rate: 100)
    project.task_groups.create!(title: "Phase 1").tasks.create!(title: "Design", status: "todo", estimated_hours: 10)
    EstimateGenerator.new(project: project, contact: @primary).generate!

    stub_pdf_rendering do
      post "/invoices", params: { client_id: @client.id }, headers: auth_headers(users(:admin))
    end
    assert_response :created

    body = JSON.parse(response.body)
    assert_equal [], body["warnings"]
  end

  test "unbilled_entries excludes entries already consumed by a fixed-price invoice" do
    fixed_project = @client.projects.create!(name: "Fixed", billing_mode: "fixed_price", billing_amount: 500)
    entry = fixed_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 3)
    InvoiceGenerator.new(client: @client, contact: @primary).generate!

    get "/invoices/unbilled_entries", params: { client_id: @client.id }, headers: auth_headers(users(:admin))
    assert_response :success

    ids = JSON.parse(response.body).map { |e| e["id"] }
    assert_not_includes ids, entry.id
  end

  test "create with custom: true builds a blank invoice with no line items" do
    post "/invoices", params: { client_id: @client.id, custom: true }, headers: auth_headers(users(:admin))

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal [], body["invoice_line_items"]
    assert_nil body["total"]
  end

  test "attach_time_entries marks entries billed against the invoice" do
    invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    entry = @project.time_entries.create!(user: users(:admin), date: Date.current, hours: 3)

    post "/invoices/#{invoice.id}/attach_time_entries",
      params: { time_entry_ids: [entry.id] }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :success
    assert_equal invoice.id, entry.reload.invoice_id
  end

  test "attach_time_entries with a single entry and line_item_id converts the line to a real time-kind line" do
    invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    line_item = invoice.invoice_line_items.create!(kind: "custom", description: "")
    entry = @project.time_entries.create!(user: users(:admin), date: Date.current, hours: 3)

    post "/invoices/#{invoice.id}/attach_time_entries",
      params: { time_entry_ids: [entry.id], line_item_id: line_item.id }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :success
    line_item.reload
    assert_equal "time", line_item.kind
    assert_equal entry, line_item.time_entry
    assert_equal entry.billing_description, line_item.description
  end

  test "attach_time_entries preserves a description already on the line instead of overwriting it" do
    invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    line_item = invoice.invoice_line_items.create!(kind: "custom", description: "My custom label")
    entry = @project.time_entries.create!(user: users(:admin), date: Date.current, hours: 3)

    post "/invoices/#{invoice.id}/attach_time_entries",
      params: { time_entry_ids: [entry.id], line_item_id: line_item.id }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :success
    assert_equal "My custom label", line_item.reload.description
  end

  test "attach_time_entries rejects an already-billed entry" do
    invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    entry = @project.time_entries.create!(user: users(:admin), date: Date.current, hours: 3, invoice: invoice)

    other_invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    post "/invoices/#{other_invoice.id}/attach_time_entries",
      params: { time_entry_ids: [entry.id] }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :unprocessable_entity
  end

  test "attach_time_entries rejects an entry belonging to a different client" do
    invoice = Invoice.create!(client: @client, contact: @primary, status: "pending")
    other_client = @bp.clients.create!(name: "Other Client")
    other_project = other_client.projects.create!(name: "Other Project")
    other_entry = other_project.time_entries.create!(user: users(:admin), date: Date.current, hours: 1)

    post "/invoices/#{invoice.id}/attach_time_entries",
      params: { time_entry_ids: [other_entry.id] }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")

    assert_response :unprocessable_entity
    assert_nil other_entry.reload.invoice_id
  end
end
