class TasksController < ApplicationController
  before_action :set_task_group
  before_action :set_task, only: %i[update destroy]

  def create
    task = @task_group.tasks.build(task_params)
    task.status ||= "todo"
    if task.save
      render json: task.as_json(only: %i[id title status position estimated_hours]), status: :created
    else
      render json: { errors: task.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      render json: @task.as_json(only: %i[id title status position estimated_hours])
    else
      render json: { errors: @task.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @task.destroy
    head :no_content
  end

  # PATCH /projects/:project_id/task_groups/:task_group_id/tasks/reorder
  # body: { ids: [1, 2, 3], task_group_id: 5 }  (task_group_id for cross-group moves)
  def reorder
    ids = params[:ids] || []
    target_group_id = params[:target_group_id] || @task_group.id
    ids.each_with_index do |id, idx|
      Task.where(id: id).update_all(position: idx + 1, task_group_id: target_group_id)
    end
    head :no_content
  end

  private

  def set_task_group
    project = Project.find(params[:project_id])
    @task_group = project.task_groups.find(params[:task_group_id])
  end

  def set_task
    @task = @task_group.tasks.find(params[:id])
  end

  def task_params
    params.require(:task).permit(:title, :status, :position, :task_group_id, :estimated_hours)
  end
end
