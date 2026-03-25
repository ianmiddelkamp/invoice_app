class TimeEntry < ApplicationRecord
  belongs_to :user
  belongs_to :project
  belongs_to :task, optional: true
  has_one :invoice_line_item

  validates :date, presence: true
  validates :hours, presence: true, numericality: { greater_than: 0 }
end