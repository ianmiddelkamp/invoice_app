class SowImportsController < ApplicationController
  def create
    text = if params[:text].present?
             params[:text]
           elsif params[:file].present?
             file = params[:file]
             unless %w[text/plain text/markdown application/vnd.openxmlformats-officedocument.wordprocessingml.document].any? { |t| file.content_type&.include?(t.split("/").last) } || file.original_filename.match?(/\.(md|txt|docx)$/i)
               return render json: { error: "Only .md, .txt, and .docx files are supported." }, status: :unprocessable_entity
             end
             SowImporter.extract_text(file)
           else
             return render json: { error: "No file or text provided." }, status: :unprocessable_entity
           end

    provider = Rails.application.config.sow_provider
    limit    = SowImporter::MAX_CHARS[provider]

    if limit && text.length > limit
      return render json: {
        error: "Document is too long for #{provider} (#{text.length} characters, limit is #{limit}). Please split it into smaller sections."
      }, status: :unprocessable_entity
    end

    group = SowImporter.new(text).parse
    render json: group
  rescue => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
