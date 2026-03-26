class Estimate < ApplicationRecord
  belongs_to :project
  has_one :client, through: :project
  has_many :estimate_line_items, dependent: :destroy

  has_one_attached :pdf

  STATUSES = %w[draft sent accepted declined].freeze
  validates :status, inclusion: { in: STATUSES }

  def number
    "EST-#{id.to_s.rjust(4, "0")}"
  end
end
