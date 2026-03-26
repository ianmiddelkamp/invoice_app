require "tempfile"

module PdfRenderer
  BROWSER_OPTIONS = {
    browser_path: "/usr/bin/chromium",
    headless: :new,
    browser_options: {
      "no-sandbox" => nil,
      "disable-setuid-sandbox" => nil,
      "disable-dev-shm-usage" => nil
    }
  }.freeze

  def render_to_pdf(html)
    browser = Ferrum::Browser.new(**BROWSER_OPTIONS)

    Tempfile.create(["pdf_render", ".html"]) do |f|
      f.write(html)
      f.flush
      browser.go_to("file://#{f.path}")
      browser.pdf(
        paper_width: 8.27,
        paper_height: 11.69,
        print_background: true,
        margin_top: 0.6,
        margin_bottom: 0.6,
        margin_left: 0.6,
        margin_right: 0.6,
        encoding: :binary
      )
    end
  ensure
    browser&.quit
  end
end
