class TimeEntriesController < ApplicationController
  before_action :set_project, if: -> { params[:project_id].present? }
  before_action :set_time_entry, only: [:show, :update, :destroy]

  def index
    render json: filtered_entries
      .as_json(
        include: {
          task: { only: %i[id title] },
          project: { only: %i[id name client_id], include: { client: { only: %i[id name] } } },
          charge_code: { only: %i[id code description] },
          client: { only: %i[id name] },
          invoice: { only: %i[id], methods: :number }
        }
      )
  end

  # TODO: replace with the business's own configured timezone once BusinessProfile supports one.
  EXPORT_TIME_ZONE = "Eastern Time (US & Canada)"

  # GET /time_entries/export?format=csv|xlsx|md
  # Exports the same filtered set as #index (client_id/project_id/status/charge_code_ids),
  # so the export always matches what's currently shown on the Timesheets page. Times are
  # converted explicitly to EXPORT_TIME_ZONE rather than relying on the app's global
  # config.time_zone, so the export doesn't silently drift if that default ever changes.
  def export
    headers = ["Date", "Start Time", "End Time", "Hours", "Client", "Project / Code", "Task", "Description", "Invoice"]
    rows = filtered_entries.map do |entry|
      [
        entry.date.to_s,
        entry.started_at&.in_time_zone(EXPORT_TIME_ZONE)&.strftime("%Y-%m-%d %H:%M:%S %Z"),
        entry.stopped_at&.in_time_zone(EXPORT_TIME_ZONE)&.strftime("%Y-%m-%d %H:%M:%S %Z"),
        entry.hours,
        entry.client&.name || entry.project&.client&.name,
        entry.project&.name || entry.charge_code&.code,
        entry.task&.title,
        entry.description,
        entry.invoice&.number || "Unbilled"
      ]
    end

    case params[:format]
    when "csv"
      send_data TableExport.csv(headers, rows), filename: "timesheets.csv", type: "text/csv"
    when "xlsx"
      send_data TableExport.xlsx("Timesheets", headers, rows), filename: "timesheets.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when "md"
      send_data TableExport.markdown("Timesheets", headers, rows), filename: "timesheets.md", type: "text/markdown"
    else
      render json: { error: "Unsupported format" }, status: :unprocessable_entity
    end
  end

  def show
    render json: @time_entry.as_json(
      include: {
        task: { only: %i[id title] },
        project: { only: %i[id name] },
        charge_code: { only: %i[id code description] }
      }
    )
  end

  def create
    validate_tenant_foreign_keys!(time_entry_params)

    @time_entry = if @project
      @project.time_entries.new(time_entry_params.merge(user: @current_user))
    else
      @current_user.time_entries.new(time_entry_params)
    end

    if @time_entry.save
      render json: @time_entry, status: :created
    else
      render json: { errors: @time_entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    validate_tenant_foreign_keys!(time_entry_params)

    if @time_entry.update(time_entry_params)
      render json: @time_entry
    else
      render json: { errors: @time_entry.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @time_entry.destroy
    head :no_content
  end

  private

  # `@project` gets set from `params[:project_id]` regardless of whether that came from the
  # nested route path (/projects/:project_id/time_entries, used by TaskBoard — always wants the
  # project's full history, no other filters) or as a plain query param on the flat route
  # (/time_entries?project_id=X, used by the Timesheets page's project dropdown, which very much
  # still wants status/charge_code_ids applied alongside it). Scoping to @project must not
  # short-circuit the rest of these filters — only skip the client_id/project_id/charge_code_ids
  # filters below that @project already makes redundant (a specific project has no charge codes).
  def filtered_entries
    scope = @project ? @project.time_entries : @current_user.time_entries

    unless @project
      if params[:client_id].present?
        scope = scope.left_outer_joins(:project).where(
          "(time_entries.project_id IS NOT NULL AND projects.client_id = :cid) OR " \
          "(time_entries.charge_code_id IS NOT NULL AND time_entries.client_id = :cid)",
          cid: params[:client_id]
        )
      end
      scope = scope.where(project_id: params[:project_id]) if params[:project_id].present?
      if params[:charge_code_ids].present?
        scope = scope.where(charge_code_id: params[:charge_code_ids].to_s.split(","))
      end
    end

    if params[:status] == "unbilled"
      scope = scope.where(invoice_id: nil)
    elsif params[:status] == "billed"
      scope = scope.where.not(invoice_id: nil)
    end

    scope.includes(:task, :charge_code, :client, :invoice, project: :client).order(date: :desc)
  end

  def set_project
    @project = current_business_profile.projects.find(params[:project_id])
  end

  def set_time_entry
    @time_entry = @project ? @project.time_entries.find(params[:id]) : @current_user.time_entries.find(params[:id])
  end

  def time_entry_params
    params.require(:time_entry).permit(
      :date, :hours, :description,
      :started_at, :stopped_at,
      :task_id, :project_id, :charge_code_id, :client_id
    )
  end

  # time_entry_params permits project_id/client_id/charge_code_id/task_id directly from the
  # request body (needed for the top-level, non-nested create/update path). Without this check
  # those foreign keys were unvalidated, letting a request point a time entry at another tenant's
  # project/client/charge code/task — this raises RecordNotFound (404) the same way the rest of
  # the app's tenant-scoped .find calls do.
  def validate_tenant_foreign_keys!(entry_params)
    current_business_profile.projects.find(entry_params[:project_id]) if entry_params[:project_id].present?
    current_business_profile.clients.find(entry_params[:client_id]) if entry_params[:client_id].present?
    @current_user.charge_codes.find(entry_params[:charge_code_id]) if entry_params[:charge_code_id].present?

    if entry_params[:task_id].present?
      Task.joins(task_group: :project).merge(current_business_profile.projects).find(entry_params[:task_id])
    end
  end
end
