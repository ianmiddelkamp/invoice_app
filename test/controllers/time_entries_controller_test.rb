require "test_helper"

class TimeEntriesControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user)
    token = JsonWebToken.encode(user_id: user.id)
    { "Authorization" => "Bearer #{token}" }
  end

  setup do
    @mine   = BusinessProfile.for_user(users(:admin))
    @theirs = BusinessProfile.for_user(users(:member))

    @my_project    = Project.create!(name: "Mine", client: @mine.clients.create!(name: "My Client"))
    @their_project = Project.create!(name: "Theirs", client: @theirs.clients.create!(name: "Their Client"))
  end

  test "create rejects a project_id belonging to another tenant" do
    assert_no_difference "TimeEntry.count" do
      post "/time_entries",
        params: { time_entry: { date: Date.current, hours: 1, project_id: @their_project.id } }.to_json,
        headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    end
    assert_response :not_found
  end

  test "create rejects a client_id belonging to another tenant" do
    assert_no_difference "TimeEntry.count" do
      post "/time_entries",
        params: { time_entry: { date: Date.current, hours: 1, charge_code_id: nil, client_id: @theirs.clients.first.id, project_id: @my_project.id } }.to_json,
        headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    end
    assert_response :not_found
  end

  test "create succeeds with a project_id belonging to the current tenant" do
    assert_difference "TimeEntry.count", 1 do
      post "/time_entries",
        params: { time_entry: { date: Date.current, hours: 1, project_id: @my_project.id } }.to_json,
        headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    end
    assert_response :created
  end

  test "update rejects re-pointing an entry at another tenant's project" do
    entry = TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project)

    patch "/time_entries/#{entry.id}",
      params: { time_entry: { project_id: @their_project.id } }.to_json,
      headers: auth_headers(users(:admin)).merge("Content-Type" => "application/json")
    assert_response :not_found

    assert_equal @my_project.id, entry.reload.project_id
  end

  test "export returns csv, xlsx, and md for supported formats" do
    TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1.5, project: @my_project)

    get "/time_entries/export", params: { format: "csv" }, headers: auth_headers(users(:admin))
    assert_response :success
    assert_includes response.body, "My Client"

    get "/time_entries/export", params: { format: "xlsx" }, headers: auth_headers(users(:admin))
    assert_response :success

    get "/time_entries/export", params: { format: "md" }, headers: auth_headers(users(:admin))
    assert_response :success
    assert_includes response.body, "# Timesheets"
  end

  test "export rejects an unsupported format" do
    get "/time_entries/export", params: { format: "pdf" }, headers: auth_headers(users(:admin))
    assert_response :unprocessable_entity
  end

  test "export only includes the current tenant's entries" do
    TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project)
    TimeEntry.create!(user: users(:member), date: Date.current, hours: 1, project: @their_project)

    get "/time_entries/export", params: { format: "csv" }, headers: auth_headers(users(:admin))
    assert_response :success
    assert_includes response.body, "My Client"
    refute_includes response.body, "Their Client"
  end

  test "index applies the unbilled status filter even when also filtering by project_id" do
    # project_id lands in the same params key whether it came from the nested route
    # (/projects/:project_id/time_entries) or, like here, as a flat-route query param — the
    # status filter must still apply in the latter case, not be silently skipped.
    unbilled = TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project)
    invoice = Invoice.create!(
      client: @my_project.client,
      contact: @my_project.client.contacts.create!(name: "Contact", primary: true),
      status: "pending"
    )
    billed = TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project, invoice: invoice)

    get "/time_entries", params: { project_id: @my_project.id, status: "unbilled" }, headers: auth_headers(users(:admin))
    assert_response :success

    ids = JSON.parse(response.body).map { |e| e["id"] }
    assert_includes ids, unbilled.id
    assert_not_includes ids, billed.id
  end

  test "index applies the billed status filter even when also filtering by project_id" do
    unbilled = TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project)
    invoice = Invoice.create!(
      client: @my_project.client,
      contact: @my_project.client.contacts.create!(name: "Contact", primary: true),
      status: "pending"
    )
    billed = TimeEntry.create!(user: users(:admin), date: Date.current, hours: 1, project: @my_project, invoice: invoice)

    get "/time_entries", params: { project_id: @my_project.id, status: "billed" }, headers: auth_headers(users(:admin))
    assert_response :success

    ids = JSON.parse(response.body).map { |e| e["id"] }
    assert_includes ids, billed.id
    assert_not_includes ids, unbilled.id
  end
end
