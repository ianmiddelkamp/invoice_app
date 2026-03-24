class CreateTimeEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :time_entries do |t|
      t.references :user, null: false, foreign_key: true
      t.references :project, null: false, foreign_key: true
      t.date :date, null: false
      t.decimal :hours, null: false, precision: 5, scale: 2
      t.text :description

      t.timestamps
    end
  end
end
