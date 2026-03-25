class TimerSessionsController < ApplicationController
  def current
    session = TimerSession.active.order(started_at: :desc).first
    if session
      render json: session_json(session)
    else
      render json: nil
    end
  end

  def start
    # Stop any existing active session first
    TimerSession.active.update_all(stopped_at: Time.current)

    session = TimerSession.create!(
      project_id: params[:project_id],
      task_id: params[:task_id].presence,
      user: @current_user,
      started_at: Time.current,
      description: params[:description]
    )

    # Mark task as in_progress when timer starts
    Task.where(id: params[:task_id]).update_all(status: 'in_progress') if params[:task_id].present?

    render json: session_json(session), status: :created
  end

  def stop
    session = TimerSession.active.order(started_at: :desc).first

    unless session
      render json: { error: "No active timer." }, status: :not_found
      return
    end

    session.update!(
      stopped_at: Time.current,
      project_id: params[:project_id] || session.project_id,
      description: params[:description]
    )

    time_entry = TimeEntry.create!(
      project_id: session.project_id,
      task_id: session.task_id,
      user: @current_user,
      date: session.started_at.to_date,
      hours: session.hours,
      description: session.description,
      started_at: session.started_at,
      stopped_at: session.stopped_at
    )

    render json: { timer_session: session_json(session), time_entry: time_entry.as_json }
  end

  def update
    session = TimerSession.active.order(started_at: :desc).first
    unless session
      render json: { error: "No active timer." }, status: :not_found
      return
    end
    session.update!(description: params[:description])
    render json: session_json(session)
  end

  def cancel
    TimerSession.active.update_all(stopped_at: Time.current)
    head :no_content
  end

  private

  def session_json(session)
    session.as_json(include: { project: { include: :client }, task: { only: %i[id title status] } })
  end
end
