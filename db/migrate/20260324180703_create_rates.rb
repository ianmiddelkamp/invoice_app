class CreateRates < ActiveRecord::Migration[8.1]
  def change
    create_table :rates do |t|
      t.timestamps
    end
  end
end
