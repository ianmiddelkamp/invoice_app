class Project < ApplicationRecord
  BILLING_MODES = %w[hourly fixed_price capped].freeze

  belongs_to :client
  has_many :time_entries
  has_many :rates
  has_many :estimates, dependent: :destroy
  has_many :disbursements, dependent: :destroy
  has_many :task_groups, -> { order(:position) }, dependent: :destroy
  has_many_attached :project_files

  validates :name, presence: true
  validates :billing_mode, inclusion: { in: BILLING_MODES }
  validates :billing_amount, presence: true, numericality: { greater_than: 0 },
            unless: -> { billing_mode == "hourly" }

  def current_rate
    rates.first&.rate
  end

  def hourly?
    billing_mode == "hourly"
  end

  def fixed_price?
    billing_mode == "fixed_price"
  end

  def capped?
    billing_mode == "capped"
  end

  # Tasks with a real estimate on them, in document order — the set both generators bill/quote
  # from. Was duplicated identically in EstimateGenerator and InvoiceGenerator; lives here now so
  # fixed_price_quote_drift can compare against the exact same set without a third copy.
  def estimated_tasks
    task_groups
      .order(:position)
      .includes(:tasks)
      .flat_map { |g| g.tasks.order(:position) }
      .select { |t| t.estimated_hours.present? && t.estimated_hours > 0 }
  end

  # Fixed Price's total always lands on billing_amount by construction (the adjustment line is
  # computed as a residual — see InvoiceGenerator#bill_fixed_price/EstimateGenerator#generate!),
  # so that number never needs validating. What it doesn't guarantee is that the *breakdown*
  # being billed still matches what the client actually saw and agreed to — tasks can be added,
  # removed, or re-estimated after an estimate is sent/accepted and before the invoice is
  # generated. This compares the currently-estimated tasks against the most recently accepted
  # estimate for this project (falling back to the most recent estimate of any status if none has
  # been accepted yet), surfacing that drift as a warning rather than blocking anything.
  #
  # Returns nil when there's no estimate to compare against, or nothing has changed.
  def fixed_price_quote_drift
    reference = estimates.where(status: "accepted").order(created_at: :desc).first ||
                estimates.order(created_at: :desc).first
    return nil unless reference

    quoted  = reference.estimate_line_items.where.not(task_id: nil).index_by(&:task_id)
    current = estimated_tasks.index_by(&:id)

    # All three consistently identify a task as "Group · Task" — matches how it's actually
    # labeled on the estimate/invoice, and how the quoted line's own #description was built.
    added   = current.values.reject { |t| quoted.key?(t.id) }.map { |t| "#{t.task_group.title} · #{t.title}" }
    removed = quoted.values.reject { |item| current.key?(item.task_id) }.map(&:description)
    changed = current.values.filter_map do |t|
      item = quoted[t.id]
      next unless item && item.hours != t.estimated_hours
      "#{t.task_group.title} · #{t.title} (#{item.hours}h quoted → #{t.estimated_hours}h now)"
    end

    return nil if added.empty? && removed.empty? && changed.empty?

    { reference: reference.number, added: added, removed: removed, changed: changed }
  end

  # Fixed Price's total lands on billing_amount by construction when billed through the
  # generator (see fixed_price_quote_drift above) — but the custom invoice creator lets someone
  # hand-build multiple invoices for the same project (e.g. splitting a fixed price into two
  # milestone payments), and nothing stops those from summing to more than what was agreed.
  # Surfaced as a non-blocking warning, same philosophy as fixed_price_quote_drift — never
  # blocks saving, just flags it.
  def fixed_price_overage_warning
    return nil unless fixed_price?
    billed = InvoiceLineItem.where(project: self).sum(:amount)
    return nil if billed <= billing_amount
    "#{name}'s invoices now total $#{billed} against its $#{billing_amount} fixed price " \
      "($#{billed - billing_amount} over)."
  end
end