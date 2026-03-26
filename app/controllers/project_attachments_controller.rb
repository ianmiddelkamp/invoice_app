class ProjectAttachmentsController < ApplicationController
  before_action :set_project

  ALLOWED_TYPES = %w[
    application/pdf
    application/msword
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.ms-excel
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-powerpoint
    application/vnd.openxmlformats-officedocument.presentationml.presentation
    text/plain text/csv
    image/png image/jpeg image/gif image/webp
    application/zip
  ].freeze

  MAX_SIZE = 20.megabytes

  def index
    render json: attachment_list
  end

  def create
    file = params[:file]
    return render json: { error: "No file provided." }, status: :unprocessable_entity unless file

    unless ALLOWED_TYPES.include?(file.content_type)
      return render json: { error: "File type not allowed." }, status: :unprocessable_entity
    end

    if file.size > MAX_SIZE
      return render json: { error: "File exceeds 20 MB limit." }, status: :unprocessable_entity
    end

    @project.project_files.attach(file)
    blob = @project.project_files.last.blob
    render json: blob_json(blob), status: :created
  end

  def show
    blob = find_blob
    return render json: { error: "Not found." }, status: :not_found unless blob

    send_data blob.download,
      filename: blob.filename.to_s,
      content_type: blob.content_type,
      disposition: "attachment"
  end

  def destroy
    attachment = @project.project_files.joins(:blob)
                         .where(active_storage_blobs: { id: params[:id] })
                         .first
    return render json: { error: "Not found." }, status: :not_found unless attachment

    attachment.purge
    head :no_content
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def find_blob
    @project.project_files
            .joins(:blob)
            .where(active_storage_blobs: { id: params[:id] })
            .first
            &.blob
  end

  def attachment_list
    @project.project_files.map { |attachment| blob_json(attachment.blob) }
  end

  def blob_json(blob)
    {
      id:           blob.id,
      filename:     blob.filename.to_s,
      content_type: blob.content_type,
      byte_size:    blob.byte_size,
      created_at:   blob.created_at
    }
  end
end
