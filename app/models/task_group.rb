class TaskGroup < ApplicationRecord
  belongs_to :project
  has_many :tasks, -> { order(:position) }, dependent: :destroy

  validates :title, presence: true

  def estimated_hours_total
    tasks.sum { |t| t.estimated_hours || 0 }
  end

  def actual_hours_total
    tasks.sum(&:actual_hours)
  end

  before_create :set_position

  private

  def set_position
    self.position ||= (project.task_groups.maximum(:position) || 0) + 1
  end
end
