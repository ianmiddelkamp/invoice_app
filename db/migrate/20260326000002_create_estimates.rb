class CreateEstimates < ActiveRecord::Migration[8.1]
  def change
    create_table :estimates do |t|
      t.references :project, null: false, foreign_key: true
      t.string :status, null: false, default: "draft"
      t.decimal :total, precision: 10, scale: 2

      t.timestamps
    end

    create_table :estimate_line_items do |t|
      t.references :estimate, null: false, foreign_key: true
      t.references :task, null: false, foreign_key: true
      t.string :description
      t.decimal :hours, precision: 5, scale: 2, null: false
      t.decimal :rate, precision: 8, scale: 2, null: false
      t.decimal :amount, precision: 10, scale: 2, null: false

      t.timestamps
    end
  end
end
