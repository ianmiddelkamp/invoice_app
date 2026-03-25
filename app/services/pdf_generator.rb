require "prawn"
require "prawn/table"

class PdfGenerator
  INDIGO     = "4338ca"
  LIGHT_GRAY = "f3f4f6"
  MID_GRAY   = "6b7280"
  DARK       = "111827"

  def initialize(invoice)
    @invoice  = invoice
    @client   = invoice.client
    @business = BusinessProfile.instance
    @items    = invoice.invoice_line_items
                       .includes(time_entry: :project)
                       .order("time_entries.date ASC")
  end

  def generate
    Prawn::Document.new(page_size: "A4", margin: [50, 50, 50, 50]) do |pdf|
      pdf.font_families.update(
        "Helvetica" => {
          normal: "Helvetica",
          bold: "Helvetica-Bold"
        }
      )
      pdf.font "Helvetica"

      draw_header(pdf)
      pdf.move_down 30
      draw_parties(pdf)
      pdf.move_down 25
      draw_line_items(pdf)
      pdf.move_down 15
      draw_total(pdf)
      pdf.move_down 30
      draw_footer(pdf)
    end.render
  end

  private

  def draw_header(pdf)
    pdf.float do
      pdf.font_size(32) { pdf.text "INVOICE", style: :bold, color: INDIGO }
    end

    pdf.text_box @invoice.number,
      at: [0, pdf.cursor],
      width: pdf.bounds.width,
      align: :right,
      size: 14,
      style: :bold,
      color: DARK

    pdf.move_down 6

    date_line = "Date: #{format_date(@invoice.created_at)}"
    date_line += "   Period: #{format_date(@invoice.start_date)} – #{format_date(@invoice.end_date)}" if @invoice.start_date

    pdf.text_box date_line,
      at: [0, pdf.cursor],
      width: pdf.bounds.width,
      align: :right,
      size: 10,
      color: MID_GRAY

    pdf.move_down 16
    pdf.stroke_color INDIGO
    pdf.line_width 1.5
    pdf.stroke_horizontal_rule
  end

  def draw_parties(pdf)
    col_width = (pdf.bounds.width - 20) / 2

    # FROM
    pdf.float do
      pdf.bounding_box([0, pdf.cursor], width: col_width) do
        pdf.font_size(8) { pdf.text "FROM", style: :bold, color: MID_GRAY }
        pdf.move_down 4
        pdf.font_size(11) { pdf.text @business.name.presence || "Your Business Name", style: :bold, color: DARK }
        pdf.font_size(9) do
          address_parts = [@business.address1, @business.city, @business.state, @business.postcode].compact_blank
          pdf.text address_parts.join(", "), color: MID_GRAY if address_parts.any?
          pdf.text @business.email,      color: MID_GRAY if @business.email.present?
          pdf.text @business.phone,      color: MID_GRAY if @business.phone.present?
          pdf.text "HST # #{@business.hst_number}", color: MID_GRAY if @business.hst_number.present?
        end
      end
    end

    # BILL TO
    pdf.bounding_box([col_width + 20, pdf.cursor], width: col_width) do
      pdf.font_size(8) { pdf.text "BILL TO", style: :bold, color: MID_GRAY }
      pdf.move_down 4
      pdf.font_size(11) { pdf.text @client.name, style: :bold, color: DARK }
      pdf.font_size(9) do
        pdf.text @client.contact_name, color: MID_GRAY if @client.contact_name.present?
        pdf.text @client.email1, color: MID_GRAY if @client.email1.present?
        pdf.text @client.phone1, color: MID_GRAY if @client.phone1.present?
        address_parts = [@client.address1, @client.city, @client.state, @client.postcode].compact_blank
        pdf.text address_parts.join(", "), color: MID_GRAY if address_parts.any?
      end
    end
  end

  def draw_line_items(pdf)
    headers = [
      { content: "Date",        width: 65  },
      { content: "Project",     width: 105 },
      { content: "Description", width: 160 },
      { content: "Hours",       width: 45  },
      { content: "Rate",        width: 55  },
      { content: "Amount",      width: 65  }
    ]

    rows = @items.map do |item|
      [
        format_date(item.time_entry.date),
        item.time_entry.project.name,
        item.description.to_s,
        item.hours.to_f.round(2).to_s,
        format_currency(item.rate),
        format_currency(item.amount)
      ]
    end

    table_data = [ headers.map { |h| h[:content] } ] + rows

    pdf.table(table_data,
      column_widths: headers.map { |h| h[:width] },
      header: true,
      cell_style: { size: 9, padding: [6, 8, 6, 8], border_color: "e5e7eb" }
    ) do |t|
      # Header row
      t.row(0).background_color = INDIGO
      t.row(0).text_color = "ffffff"
      t.row(0).font_style = :bold

      # Alternating row colors
      t.rows(1..-1).each_with_index do |row, i|
        row.background_color = i.even? ? "ffffff" : LIGHT_GRAY
      end

      # Right-align numeric columns
      t.columns(3..5).align = :right
    end
  end

  def draw_total(pdf)
    pdf.stroke_color "e5e7eb"
    pdf.line_width 0.5
    pdf.stroke_horizontal_rule
    pdf.move_down 10

    pdf.font_size(12) do
      pdf.text_box "TOTAL  #{format_currency(@invoice.total)}",
        at: [0, pdf.cursor],
        width: pdf.bounds.width,
        align: :right,
        style: :bold,
        color: DARK
    end
  end

  def draw_footer(pdf)
    pdf.stroke_color "e5e7eb"
    pdf.line_width 0.5
    pdf.stroke_horizontal_rule
    pdf.move_down 8
    pdf.font_size(8) do
      pdf.text "Thank you for your business.", color: MID_GRAY
    end
  end

  def format_date(date)
    return "" unless date
    date.strftime("%d %b %Y")
  end

  def format_currency(amount)
    "$#{"%.2f" % amount.to_f}"
  end
end
