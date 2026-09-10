class TimeEntry < ApplicationRecord
  belongs_to :user
  belongs_to :project, optional: true
  belongs_to :charge_code, optional: true
  belongs_to :client, optional: true
  belongs_to :task, optional: true
  belongs_to :invoice, optional: true
  has_one :invoice_line_item

  validates :date, presence: true
  validates :hours, presence: true, numericality: { greater_than: 0 }
  validate :project_or_charge_code_required

  # Mirrors InvoiceGenerator's private build_description/effective_rate for a single entry —
  # used by InvoiceLineItemsController when attaching exactly one time entry to a custom line
  # converts it into a real "time" kind line backed by this entry.
  def billing_description
    if charge_code_id.present?
      [charge_code.code, description.presence].compact.join(" · ")
    else
      [task&.task_group&.title.presence, task&.title.presence, description.presence].compact.join(" · ")
    end
  end

  def effective_rate
    client_rates = (project&.client || client)&.rates
    if charge_code_id.present?
      charge_code.rate || client_rates&.first&.rate || 0
    else
      project&.rates&.first&.rate || client_rates&.first&.rate || 0
    end
  end

  private

  def project_or_charge_code_required
    if project_id.blank? && charge_code_id.blank?
      errors.add(:base, "must belong to a project or charge code")
    elsif project_id.present? && charge_code_id.present?
      errors.add(:base, "cannot belong to both a project and a charge code")
    end
  end
end
