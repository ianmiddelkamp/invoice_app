class AddEstimatedHoursToTasks < ActiveRecord::Migration[8.1]
  def change
    add_column :tasks, :estimated_hours, :decimal, precision: 5, scale: 2
  end
end
