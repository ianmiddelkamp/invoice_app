class EstimateMailer < ApplicationMailer
  def estimate_email(estimate, changes = nil)
    @estimate = estimate
    @client   = estimate.project.client
    @project  = estimate.project
    @business = BusinessProfile.instance
    @items    = estimate.estimate_line_items.includes(task: :task_group).order("estimate_line_items.id ASC")
    @changes  = changes

    attachments["#{@estimate.number}.pdf"] = {
      mime_type: "application/pdf",
      content: @estimate.pdf.download
    }

    mail(
      to:      @client.email1,
      subject: "Estimate #{estimate.number} from #{@business.name.presence || 'us'}"
    )
  end
end
