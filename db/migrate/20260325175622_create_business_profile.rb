class CreateBusinessProfile < ActiveRecord::Migration[8.1]
  def change
    create_table :business_profiles do |t|
      t.string :name
      t.string :email
      t.string :phone
      t.string :address1
      t.string :address2
      t.string :city
      t.string :state
      t.string :postcode
      t.string :country
      t.string :hst_number

      t.timestamps
    end
  end
end
