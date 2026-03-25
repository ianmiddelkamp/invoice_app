class Invoice < ApplicationRecord
  belongs_to :client
  has_many :invoice_line_items, dependent: :destroy
  has_many :time_entries, through: :invoice_line_items
  has_one_attached :pdf

  validates :status, inclusion: { in: %w[pending sent paid] }

  def number
    "INV-#{id.to_s.rjust(4, '0')}"
  end
end