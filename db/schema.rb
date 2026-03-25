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

ActiveRecord::Schema[8.1].define(version: 2026_03_25_175622) do
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
    t.string "email"
    t.string "hst_number"
    t.string "name"
    t.string "phone"
    t.string "postcode"
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
    t.string "state"
    t.datetime "updated_at", null: false
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

  create_table "time_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.text "description"
    t.decimal "hours", precision: 5, scale: 2, null: false
    t.bigint "project_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id"], name: "index_time_entries_on_project_id"
    t.index ["user_id"], name: "index_time_entries_on_user_id"
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
  add_foreign_key "invoice_line_items", "invoices"
  add_foreign_key "invoice_line_items", "time_entries"
  add_foreign_key "invoices", "clients"
  add_foreign_key "projects", "clients"
  add_foreign_key "rates", "clients"
  add_foreign_key "rates", "projects"
  add_foreign_key "rates", "users"
  add_foreign_key "time_entries", "projects"
  add_foreign_key "time_entries", "users"
end
