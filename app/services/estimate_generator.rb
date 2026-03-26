class EstimateGenerator
  def initialize(project:)
    @project = project
  end

  def generate!
    tasks = estimated_tasks
    return nil if tasks.empty?

    ActiveRecord::Base.transaction do
      estimate = Estimate.create!(
        project: @project,
        status: "draft"
      )

      tasks.each do |task|
        rate = effective_rate
        hours = task.estimated_hours
        EstimateLineItem.create!(
          estimate: estimate,
          task: task,
          description: build_description(task),
          hours: hours,
          rate: rate,
          amount: hours * rate
        )
      end

      estimate.update!(total: estimate.estimate_line_items.sum(:amount))
      estimate
    end
  end

  private

  def estimated_tasks
    @project.task_groups
            .includes(:tasks)
            .flat_map(&:tasks)
            .select { |t| t.estimated_hours.present? && t.estimated_hours > 0 }
  end

  def build_description(task)
    group_title = task.task_group.title
    "#{group_title} · #{task.title}"
  end

  def effective_rate
    @project.rates.first&.rate ||
      @project.client.rates.first&.rate ||
      0
  end
end
