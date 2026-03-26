class EstimatePdfGenerator
  include PdfRenderer

  def initialize(estimate)
    @estimate = estimate
    @project  = estimate.project
    @client   = @project.client
    @business = BusinessProfile.instance
    @items    = estimate.estimate_line_items
                        .includes(task: :task_group)
                        .order("estimate_line_items.id ASC")
  end

  def generate
    html = ActionController::Base.render(
      template: "pdfs/estimate",
      layout: "pdf",
      assigns: {
        estimate: @estimate,
        project: @project,
        client: @client,
        business: @business,
        items: @items,
        logo_data_uri: @business.logo_data_uri
      }
    )
    render_to_pdf(html)
  end
end
