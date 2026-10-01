require "rails_helper"

RSpec.describe ExportJob, type: :model do
  let(:tenant) { create(:tenant) }
  let(:user) { create(:user, tenant: tenant) }

  subject do
    described_class.new(
      tenant: tenant,
      user: user,
      filename: "employees_export_20261001.csv",
      status: "queued"
    )
  end

  describe "validations" do
    it "is valid with valid attributes" do
      expect(subject).to be_valid
    end

    it "validates inclusion of status in STATUSES" do
      subject.status = "invalid_status"
      expect(subject).not_to be_valid
      expect(subject.errors[:status]).to be_present
    end

    it "validates presence of filename" do
      subject.filename = nil
      expect(subject).not_to be_valid
      expect(subject.errors[:filename]).to be_present
    end
  end

  describe "associations" do
    it "belongs to a tenant" do
      expect(described_class.reflect_on_association(:tenant).macro).to eq(:belongs_to)
    end

    it "belongs to a user" do
      expect(described_class.reflect_on_association(:user).macro).to eq(:belongs_to)
    end
  end

  describe "#progress_percentage" do
    it "returns 100 when completed or failed" do
      subject.status = "completed"
      expect(subject.progress_percentage).to eq(100)

      subject.status = "failed"
      expect(subject.progress_percentage).to eq(100)
    end

    it "returns 0 when total_rows is 0 or nil" do
      subject.status = "processing"
      subject.total_rows = 0
      subject.processed_rows = 0
      expect(subject.progress_percentage).to eq(0)
    end

    it "calculates accurate percentage during processing" do
      subject.status = "processing"
      subject.total_rows = 50
      subject.processed_rows = 25
      expect(subject.progress_percentage).to eq(50)
    end
  end

  describe "#can_download?" do
    it "returns false if not completed" do
      subject.status = "processing"
      expect(subject.can_download?).to be false
    end

    it "returns false if file does not exist on disk" do
      subject.status = "completed"
      subject.file_path = "/nonexistent/path/file.csv"
      expect(subject.can_download?).to be false
    end

    it "returns false if expired" do
      temp_file = Tempfile.new("test_export.csv")
      subject.status = "completed"
      subject.file_path = temp_file.path
      subject.expires_at = 1.hour.ago
      expect(subject.can_download?).to be false
      temp_file.close!
    end

    it "returns true if completed, file exists, and not expired" do
      temp_file = Tempfile.new("test_export.csv")
      subject.status = "completed"
      subject.file_path = temp_file.path
      subject.expires_at = 24.hours.from_now
      expect(subject.can_download?).to be true
      temp_file.close!
    end
  end
end
