class Task < ApplicationRecord
  belongs_to :task_group
  has_many :time_entries

  STATUSES = %w[todo in_progress done].freeze

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :estimated_hours, numericality: { greater_than: 0 }, allow_nil: true

  def actual_hours
    time_entries.sum(:hours)
  end

  def last_entry_date
    time_entries.maximum(:date)
  end

  before_create :set_position

  private

  def set_position
    self.position ||= (task_group.tasks.maximum(:position) || 0) + 1
  end
end
