class Invoice < ApplicationRecord
  belongs_to :client
  belongs_to :contact
  has_many :invoice_line_items, dependent: :destroy
  has_many :time_entries, dependent: :nullify
  has_one_attached :pdf

  validates :status, inclusion: { in: %w[pending sent paid] }
  validates :amount_paid, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  before_create :assign_sequence_number

  def number
    "INV-#{sequence_number.to_s.rjust(4, '0')}"
  end

  def outstanding
    (total || 0) - (amount_paid || 0)
  end

  # Single source of truth for totaling an invoice's line items — was duplicated inline in
  # InvoiceGenerator#generate!; now also called by InvoiceLineItemsController after every
  # custom-invoice line item mutation.
  def recalculate_total!
    items    = invoice_line_items.reload
    subtotal = items.sum(:amount)
    # Ruby-side sum, not SQL — a text-only custom line has amount: nil, which SQL SUM(:amount)
    # silently ignores but `nil * tax_rate` would raise here, so it needs an explicit fallback.
    tax      = items.sum { |i| (i.amount || 0) * i.tax_rate / 100 }
    update!(total: subtotal + tax)
  end

  private

  # Self-healing: never trust the stored counter alone, always also check the highest
  # sequence_number already issued for this business. Protects against a stale counter
  # (e.g. after manual data cleanup) without ever colliding with or reusing a number.
  def assign_sequence_number
    business_profile = client.business_profile
    next_number = [
      business_profile.next_invoice_number,
      business_profile.invoices.maximum(:sequence_number).to_i + 1
    ].max

    self.sequence_number = next_number
    business_profile.update!(next_invoice_number: next_number + 1)
  end
end