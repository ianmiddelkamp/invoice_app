class TimerSession < ApplicationRecord
  belongs_to :project
  belongs_to :user
  belongs_to :task, optional: true

  scope :active, -> { where(stopped_at: nil) }

  def hours
    end_time = stopped_at || Time.current
    calculated = ((end_time - started_at) / 3600.0).round(2)
    [calculated, 0.01].max
  end
end
