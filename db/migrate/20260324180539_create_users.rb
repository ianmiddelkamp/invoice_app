class CreateUsers < ActiveRecord::Migration[8.1]
   def change
    create_table :users do |t|
      t.string :email, null: false, index: { unique: true }
      t.string :name, null: false
      t.string :role
      t.string :password_digest

      t.timestamps
    end
  end
end
