class InvoicesController < ApplicationController
  before_action :set_invoice, only: [:show, :update, :destroy, :pdf, :regenerate_pdf, :send_invoice]

  def index
    invoices = Invoice.includes(:client).order(created_at: :desc)
    render json: invoices.as_json(include: :client, methods: :number)
  end

  def show
    render json: invoice_json(@invoice)
  end

  def unbilled_entries
    client = Client.find(params[:client_id])

    scope = TimeEntry
      .left_outer_joins(:invoice_line_item, :project)
      .where(invoice_line_items: { id: nil })
      .where(
        "(time_entries.project_id IS NOT NULL AND projects.client_id = :cid) OR " \
        "(time_entries.charge_code_id IS NOT NULL AND time_entries.client_id = :cid)",
        cid: client.id
      )
      .includes(:task, :charge_code, project: {})

    scope = scope.where("time_entries.date >= ?", params[:start_date]) if params[:start_date].present?
    scope = scope.where("time_entries.date <= ?", params[:end_date]) if params[:end_date].present?

    render json: scope.order("time_entries.date desc").as_json(
      include: {
        task: { only: %i[id title] },
        project: { only: %i[id name] },
        charge_code: { only: %i[id code description] }
      }
    )
  end

  def create
    client = Client.find(params[:client_id])

    begin
      invoice = InvoiceGenerator.new(
        client: client,
        start_date: params[:start_date],
        end_date: params[:end_date],
        time_entry_ids: params[:time_entry_ids]
      ).generate!
    rescue ArgumentError => e
      render json: { error: e.message }, status: :unprocessable_entity
      return
    end

    if invoice.nil?
      render json: { error: "No unbilled time entries found for this client in the selected period." },
             status: :unprocessable_entity
      return
    end

    pdf_data = PdfGenerator.new(invoice).generate
    invoice.pdf.attach(
      io: StringIO.new(pdf_data),
      filename: "#{invoice.number}.pdf",
      content_type: "application/pdf"
    )

    render json: invoice_json(invoice), status: :created
  end

  def update
    if @invoice.update(invoice_params)
      render json: invoice_json(@invoice)
    else
      render json: { errors: @invoice.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @invoice.destroy
    head :no_content
  end

  def send_invoice
    unless @invoice.client.email1.present?
      render json: { error: "Client has no email address on file." }, status: :unprocessable_entity
      return
    end

    unless @invoice.pdf.attached?
      render json: { error: "No PDF found. Please regenerate the PDF first." }, status: :unprocessable_entity
      return
    end

    InvoiceMailer.invoice_email(@invoice).deliver_now
    render json: { message: "Invoice sent to #{@invoice.client.email1}." }
  end

  def regenerate_pdf
    pdf_data = PdfGenerator.new(@invoice).generate
    @invoice.pdf.attach(
      io: StringIO.new(pdf_data),
      filename: "#{@invoice.number}.pdf",
      content_type: "application/pdf"
    )
    render json: { message: "PDF regenerated successfully" }
  end

  def pdf
    unless @invoice.pdf.attached?
      render json: { error: "PDF not available" }, status: :not_found
      return
    end

    send_data @invoice.pdf.download,
      filename: "#{@invoice.number}.pdf",
      type: "application/pdf",
      disposition: "attachment"
  end

  private

  def set_invoice
    @invoice = Invoice.find(params[:id])
  end

  def invoice_params
    params.require(:invoice).permit(:status)
  end

  def invoice_json(invoice)
    invoice.as_json(
      methods: :number,
      include: {
        client: {},
        invoice_line_items: {
          include: { time_entry: { include: [:project, :charge_code] } }
        }
      }
    )
  end
end
