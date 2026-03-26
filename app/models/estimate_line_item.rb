class EstimateLineItem < ApplicationRecord
  belongs_to :estimate
  belongs_to :task

  validates :hours, :rate, :amount, presence: true
end
