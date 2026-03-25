class AddTaskIdToTimerSessionsAndTimeEntries < ActiveRecord::Migration[8.1]
  def change
    add_reference :timer_sessions, :task, null: true, foreign_key: true
    add_reference :time_entries, :task, null: true, foreign_key: true
  end
end
