class AddDocumentSettingsToBusinessProfile < ActiveRecord::Migration[8.1]
  def change
    add_column :business_profiles, :primary_color, :string, default: "#4338ca"
    add_column :business_profiles, :invoice_footer, :text
    add_column :business_profiles, :estimate_footer, :text
    add_column :business_profiles, :default_payment_terms, :string
  end
end
