class AddPositionToInvoiceLineItems < ActiveRecord::Migration[8.1]
  def change
    add_column :invoice_line_items, :position, :integer
    add_index :invoice_line_items, [:invoice_id, :position]
  end
end
