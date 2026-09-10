class InvoiceLineItemsController < ApplicationController
  before_action :set_invoice
  before_action :set_line_item, only: [:update, :destroy]

  def create
    attrs = line_item_params.to_h.symbolize_keys.merge(kind: "custom")
    attrs[:tax_rate] = default_tax_rate if attrs[:amount].present?
    line_item = @invoice.invoice_line_items.build(attrs)
    if line_item.save
      @invoice.recalculate_total!
      render json: line_item_json(line_item), status: :created
    else
      render json: { errors: line_item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    attrs = line_item_params.to_h.symbolize_keys
    effective_amount = attrs.key?(:amount) ? attrs[:amount] : @line_item.amount
    attrs[:tax_rate] = effective_amount.present? ? default_tax_rate : 0
    if @line_item.update(attrs)
      @invoice.recalculate_total!
      render json: line_item_json(@line_item)
    else
      render json: { errors: @line_item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @line_item.destroy
    @invoice.recalculate_total!
    head :no_content
  end

  private

  def set_invoice
    @invoice = current_business_profile.invoices.find(params[:invoice_id])
  end

  def set_line_item
    @line_item = @invoice.invoice_line_items.find(params[:id])
  end

  # hours/rate/amount are deliberately optional here — a custom line can be a plain text row
  # (description only) up to a fully billable one (description + amount, optionally hours/rate).
  def line_item_params
    params.require(:invoice_line_item).permit(:description, :hours, :rate, :amount, :project_id, :position)
  end

  def line_item_json(line_item)
    line_item.as_json.merge(warnings: [line_item.project&.fixed_price_overage_warning].compact)
  end

  # HST (or whatever the business charges) applies to a real billable line the same way it
  # would if this were a generator-created invoice — a text-only row (amount: nil) has nothing
  # to tax, so callers only apply this when there's an actual amount.
  def default_tax_rate
    @invoice.client.business_profile.tax_rate || 0
  end
end
