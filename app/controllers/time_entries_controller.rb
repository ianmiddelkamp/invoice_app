class TimeEntriesController < ApplicationController
  before_action :set_project
  before_action :set_time_entry, only: [:update, :delete]

  def index
    @time_entries = @project.time_entries.order(date: :desc)
    render json: @time_entries
  end

  def create
    @time_entry = @project.time_entries.new(time_entry_params)
    if @time_entry.save
      render json: @time_entry, status: :created
    else
      render json: { errors: @time_entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @time_entry.update(time_entry_params)
      render json: @time_entry
    else
      render json: { errors: @time_entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def delete
    @time_entry.destroy
    head :no_content
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_time_entry
    @time_entry = @project.time_entries.find(params[:id])
  end

  def time_entry_params
    params.require(:time_entry).permit(:user_id, :date, :hours, :description)
  end
end
