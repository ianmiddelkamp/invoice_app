class Project < ApplicationRecord
  belongs_to :client
  has_many :time_entries
  has_many :rates
  has_many :task_groups, -> { order(:position) }, dependent: :destroy
  has_many_attached :project_files

  validates :name, presence: true

  def current_rate
    rates.first&.rate
  end
end