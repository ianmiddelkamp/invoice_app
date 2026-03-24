class TimeEntriesController < ApplicationController
  before_action :set_project

  def index
    @time_entries = @project.time_entries.includes(:user)
    render json: @time_entries.as_json(include: :user)
  end

  def create
    @time_entry = @project.time_entries.new(time_entry_params)

    if @time_entry.save
      render json: @time_entry.as_json(include: :user), status: :created
    else
      render json: { errors: @time_entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def time_entry_params
    params.require(:time_entry).permit(:user_id, :date, :hours)
  end
end