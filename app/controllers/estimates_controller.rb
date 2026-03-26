class EstimatesController < ApplicationController
  before_action :set_estimate, only: [:show, :update, :destroy, :pdf, :regenerate_pdf, :send_estimate]

  def index
    estimates = Estimate.includes(project: :client).order(created_at: :desc)
    render json: estimates.as_json(
      methods: :number,
      include: { project: { only: %i[id name], include: { client: { only: %i[id name] } } } }
    )
  end

  def show
    render json: estimate_json(@estimate)
  end

  def create
    project = Project.find(params[:project_id])

    estimate = EstimateGenerator.new(project: project).generate!

    if estimate.nil?
      render json: { error: "No tasks with estimated hours found for this project." },
             status: :unprocessable_entity
      return
    end

    pdf_data = EstimatePdfGenerator.new(estimate).generate
    estimate.pdf.attach(
      io: StringIO.new(pdf_data),
      filename: "#{estimate.number}.pdf",
      content_type: "application/pdf"
    )

    render json: estimate_json(estimate), status: :created
  end

  def update
    if @estimate.update(estimate_params)
      render json: estimate_json(@estimate)
    else
      render json: { errors: @estimate.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @estimate.destroy
    head :no_content
  end

  def send_estimate
    unless @estimate.project.client.email1.present?
      render json: { error: "Client has no email address on file." }, status: :unprocessable_entity
      return
    end

    unless @estimate.pdf.attached?
      render json: { error: "No PDF found. Please regenerate the PDF first." }, status: :unprocessable_entity
      return
    end

    EstimateMailer.estimate_email(@estimate).deliver_later
    render json: { message: "Estimate sent to #{@estimate.project.client.email1}." }
  end

  def regenerate_pdf
    pdf_data = EstimatePdfGenerator.new(@estimate).generate
    @estimate.pdf.attach(
      io: StringIO.new(pdf_data),
      filename: "#{@estimate.number}.pdf",
      content_type: "application/pdf"
    )
    render json: { message: "PDF regenerated successfully" }
  end

  def pdf
    unless @estimate.pdf.attached?
      render json: { error: "PDF not available" }, status: :not_found
      return
    end

    send_data @estimate.pdf.download,
      filename: "#{@estimate.number}.pdf",
      type: "application/pdf",
      disposition: "attachment"
  end

  private

  def set_estimate
    @estimate = Estimate.find(params[:id])
  end

  def estimate_params
    params.require(:estimate).permit(:status)
  end

  def estimate_json(estimate)
    estimate.as_json(
      methods: :number,
      include: {
        project: {
          only: %i[id name],
          include: { client: {} }
        },
        estimate_line_items: {
          include: { task: { only: %i[id title] } }
        }
      }
    )
  end
end
