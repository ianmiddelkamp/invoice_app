class InvoicesController < ApplicationController
  before_action :set_invoice, only: [:show, :update, :destroy, :pdf]

  def index
    invoices = Invoice.includes(:client).order(created_at: :desc)
    render json: invoices.as_json(include: :client, methods: :number)
  end

  def show
    render json: invoice_json(@invoice)
  end

  def create
    client = Client.find(params[:client_id])

    invoice = InvoiceGenerator.new(
      client: client,
      start_date: params[:start_date],
      end_date: params[:end_date]
    ).generate!

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
          include: { time_entry: { include: :project } }
        }
      }
    )
  end
end
