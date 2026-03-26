class TaskGroupsController < ApplicationController
  before_action :set_project
  before_action :set_task_group, only: %i[update destroy]

  def index
    groups = @project.task_groups.includes(tasks: :time_entries)
    render json: groups.as_json(include: { tasks: { only: %i[id title status position estimated_hours],
                                                    methods: %i[actual_hours last_entry_date] } },
                                only: %i[id title position], methods: %i[estimated_hours_total actual_hours_total])
  end

  def create
    group = @project.task_groups.build(task_group_params)
    if group.save
      render json: group.as_json(include: { tasks: { only: %i[id title status position estimated_hours],
                                                    methods: %i[actual_hours last_entry_date] } },
                                 only: %i[id title position], methods: %i[estimated_hours_total actual_hours_total]), status: :created
    else
      render json: { errors: group.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @task_group.update(task_group_params)
      render json: @task_group.as_json(include: { tasks: { only: %i[id title status position estimated_hours],
                                                          methods: %i[actual_hours last_entry_date] } },
                                       only: %i[id title position], methods: %i[estimated_hours_total actual_hours_total])
    else
      render json: { errors: @task_group.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @task_group.destroy
    head :no_content
  end

  # PATCH /projects/:project_id/task_groups/reorder
  # body: { ids: [1, 2, 3] }
  def reorder
    ids = params[:ids] || []
    ids.each_with_index do |id, idx|
      @project.task_groups.where(id: id).update_all(position: idx + 1)
    end
    head :no_content
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task_group
    @task_group = @project.task_groups.find(params[:id])
  end

  def task_group_params
    params.require(:task_group).permit(:title, :position)
  end
end
