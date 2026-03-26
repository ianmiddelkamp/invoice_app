class BusinessProfile < ApplicationRecord
  has_one_attached :logo

  def self.instance
    first_or_create!
  end

  def logo_data_uri
    return nil unless logo.attached?
    "data:#{logo.blob.content_type};base64,#{Base64.strict_encode64(logo.download)}"
  end
end
