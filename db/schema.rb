# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_26_000004) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "business_profiles", force: :cascade do |t|
    t.string "address1"
    t.string "address2"
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.string "default_payment_terms"
    t.string "email"
    t.text "estimate_footer"
    t.string "hst_number"
    t.text "invoice_footer"
    t.string "name"
    t.string "phone"
    t.string "postcode"
    t.string "primary_color", default: "#4338ca"
    t.string "state"
    t.datetime "updated_at", null: false
  end

  create_table "clients", force: :cascade do |t|
    t.string "address1"
    t.string "address2"
    t.string "city"
    t.string "contact_name"
    t.string "country"
    t.datetime "created_at", null: false
    t.string "email1"
    t.string "email2"
    t.string "name", null: false
    t.string "phone1"
    t.string "phone2"
    t.string "postcode"
    t.string "sales_terms", default: "NET 15"
    t.string "state"
    t.datetime "updated_at", null: false
  end

  create_table "estimate_line_items", force: :cascade do |t|
    t.decimal "amount", precision: 10, scale: 2, null: false
    t.datetime "created_at", null: false
    t.string "description"
    t.bigint "estimate_id", null: false
    t.decimal "hours", precision: 5, scale: 2, null: false
    t.decimal "rate", precision: 8, scale: 2, null: false
    t.bigint "task_id", null: false
    t.datetime "updated_at", null: false
    t.index ["estimate_id"], name: "index_estimate_line_items_on_estimate_id"
    t.index ["task_id"], name: "index_estimate_line_items_on_task_id"
  end

  create_table "estimates", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "last_sent_snapshot"
    t.decimal "last_sent_total", precision: 10, scale: 2
    t.bigint "project_id", null: false
    t.string "status", default: "draft", null: false
    t.decimal "total", precision: 10, scale: 2
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_estimates_on_project_id"
  end

  create_table "invoice_line_items", force: :cascade do |t|
    t.decimal "amount", precision: 10, scale: 2
    t.datetime "created_at", null: false
    t.text "description"
    t.decimal "hours", precision: 5, scale: 2
    t.bigint "invoice_id", null: false
    t.decimal "rate", precision: 10, scale: 2
    t.bigint "time_entry_id", null: false
    t.datetime "updated_at", null: false
    t.index ["invoice_id"], name: "index_invoice_line_items_on_invoice_id"
    t.index ["time_entry_id"], name: "index_invoice_line_items_on_time_entry_id"
  end

  create_table "invoices", force: :cascade do |t|
    t.bigint "client_id", null: false
    t.datetime "created_at", null: false
    t.date "end_date"
    t.string "pdf_url"
    t.date "start_date"
    t.string "status", default: "pending"
    t.decimal "total", precision: 10, scale: 2
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_invoices_on_client_id"
  end

  create_table "projects", force: :cascade do |t|
    t.bigint "client_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_projects_on_client_id"
  end

  create_table "rates", force: :cascade do |t|
    t.bigint "client_id"
    t.datetime "created_at", null: false
    t.bigint "project_id"
    t.decimal "rate", precision: 10, scale: 2, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["client_id"], name: "index_rates_on_client_id"
    t.index ["project_id"], name: "index_rates_on_project_id"
    t.index ["user_id"], name: "index_rates_on_user_id"
  end

  create_table "task_groups", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position"
    t.bigint "project_id", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_task_groups_on_project_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.decimal "estimated_hours", precision: 5, scale: 2
    t.integer "position"
    t.string "status"
    t.bigint "task_group_id", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["task_group_id"], name: "index_tasks_on_task_group_id"
  end

  create_table "time_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.text "description"
    t.decimal "hours", precision: 5, scale: 2, null: false
    t.bigint "project_id", null: false
    t.datetime "started_at"
    t.datetime "stopped_at"
    t.bigint "task_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id"], name: "index_time_entries_on_project_id"
    t.index ["task_id"], name: "index_time_entries_on_task_id"
    t.index ["user_id"], name: "index_time_entries_on_user_id"
  end

  create_table "timer_sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "description"
    t.bigint "project_id", null: false
    t.datetime "started_at", null: false
    t.datetime "stopped_at"
    t.bigint "task_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id"], name: "index_timer_sessions_on_project_id"
    t.index ["task_id"], name: "index_timer_sessions_on_task_id"
    t.index ["user_id"], name: "index_timer_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "name", null: false
    t.string "password_digest"
    t.string "role"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "estimate_line_items", "estimates"
  add_foreign_key "estimate_line_items", "tasks"
  add_foreign_key "estimates", "projects"
  add_foreign_key "invoice_line_items", "invoices"
  add_foreign_key "invoice_line_items", "time_entries"
  add_foreign_key "invoices", "clients"
  add_foreign_key "projects", "clients"
  add_foreign_key "rates", "clients"
  add_foreign_key "rates", "projects"
  add_foreign_key "rates", "users"
  add_foreign_key "task_groups", "projects"
  add_foreign_key "tasks", "task_groups"
  add_foreign_key "time_entries", "projects"
  add_foreign_key "time_entries", "tasks"
  add_foreign_key "time_entries", "users"
  add_foreign_key "timer_sessions", "projects"
  add_foreign_key "timer_sessions", "tasks"
  add_foreign_key "timer_sessions", "users"
end
