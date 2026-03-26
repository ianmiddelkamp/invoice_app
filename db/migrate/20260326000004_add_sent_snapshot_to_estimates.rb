class AddSentSnapshotToEstimates < ActiveRecord::Migration[8.0]
  def change
    add_column :estimates, :last_sent_snapshot, :jsonb
    add_column :estimates, :last_sent_total, :decimal, precision: 10, scale: 2
  end
end
