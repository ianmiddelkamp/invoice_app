class ProjectsController < ApplicationController
  before_action :set_project, only: [:show, :update, :delete]

  def index
    render json: Project.includes(:client).order(:name).as_json(include: :client)
  end

  def show
    render json: @project.as_json(include: :client)
  end

  def create
    @project = Project.new(project_params)
    if @project.save
      render json: @project.as_json(include: :client), status: :created
    else
      render json: { errors: @project.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @project.update(project_params)
      render json: @project.as_json(include: :client)
    else
      render json: { errors: @project.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def delete
    @project.destroy
    head :no_content
  end

  private

  def set_project
    @project = Project.find(params[:id])
  end

  def project_params
    params.require(:project).permit(:name, :client_id, :description)
  end
end
