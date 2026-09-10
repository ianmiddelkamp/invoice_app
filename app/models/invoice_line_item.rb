class InvoiceLineItem < ApplicationRecord
  KINDS = %w[time fixed adjustment custom].freeze

  belongs_to :invoice
  belongs_to :time_entry, optional: true
  belongs_to :project, optional: true
  belongs_to :task, optional: true

  before_validation :set_amount

  # custom lines are hand-typed on the custom invoice creator and deliberately don't need every
  # field — a plain text row (e.g. a section label) has no hours/rate/amount at all. Every other
  # kind is generator-created and always has all three.
  validates :hours, :rate, :amount, presence: true, unless: :custom?
  validates :kind, inclusion: { in: KINDS }

  # InvoiceGenerator stamps `task` directly on every "time" kind line as of the migration that
  # added this column — falls back to the time entry's task for any line created before then, so
  # older invoices still group correctly instead of losing their group affiliation entirely.
  def effective_task
    task || time_entry&.task
  end

  def custom?
    kind == "custom"
  end

  # A custom line with no amount is a plain text row (e.g. a section label) — nothing to bill,
  # nothing to show in the amount/hours/rate columns.
  def text_only?
    custom? && amount.nil?
  end

  private

  # Only defaults from the time entry when one is present — Fixed Price/Capped "fixed" and
  # "adjustment" lines set hours/rate/amount explicitly and have no time_entry, so this must not
  # clobber an explicitly-set amount (was `=`, now `||=`). Skipped entirely for custom lines —
  # they're hand-typed with no time_entry, so this would otherwise coerce an intentionally-blank
  # amount/hours/rate to 0, indistinguishable from a real $0 line.
  def set_amount
    return if custom?
    self.hours  ||= time_entry&.hours || 0
    self.rate   ||= time_entry&.project&.rates&.first&.rate || 0
    self.amount ||= hours * rate
  end
end