class SowImportJob < ApplicationJob
  queue_as :default

  def perform(job_id, text)
    key = "sow_import:#{job_id}"
    begin
      groups = SowImporter.new(text).parse
      REDIS.set(key, { status: "done", groups: groups }.to_json, ex: 1800)
    rescue => e
      REDIS.set(key, { status: "error", error: e.message }.to_json, ex: 1800)
    end
  end
end
