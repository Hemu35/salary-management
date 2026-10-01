require "rails_helper"

RSpec.describe ImportRollbackService do
  let(:tenant) { create(:tenant) }
  let(:domain) { create(:domain, tenant: tenant, name: "Engineering") }
  let(:user) { create(:user, :org_admin, tenant: tenant) }

  describe ".call" do
    it "reverts newly created employees and their compensation structures" do
      emp1 = create(:employee, tenant: tenant, domain: domain, employee_number: "EMP101")
      emp2 = create(:employee, tenant: tenant, domain: domain, employee_number: "EMP102")
      rec1 = create(:compensation_record, tenant: tenant, employee: emp1, status: "active")
      create(:compensation_component, tenant: tenant, compensation_record: rec1, amount: 95000)

      job = create(:import_job,
        tenant: tenant,
        user: user,
        status: "completed",
        rollback_metadata: {
          "created_employee_ids" => [ emp1.id, emp2.id ]
        }
      )

      expect {
        described_class.call(job)
      }.to change(tenant.employees, :count).by(-2)

      expect(job.reload.status).to eq("rolled_back")
      expect(tenant.employees.where(id: [ emp1.id, emp2.id ])).to be_empty
      expect(tenant.compensation_records.where(id: rec1.id)).to be_empty
    end

    it "reverts compensation updates on existing employees and restores superseded records" do
      emp = create(:employee, tenant: tenant, domain: domain, employee_number: "EXISTING_EMP", job_title: "Staff Engineer")
      old_rec = create(:compensation_record, tenant: tenant, employee: emp, effective_date: 1.year.ago, status: "superseded")
      new_rec = create(:compensation_record, tenant: tenant, employee: emp, effective_date: Date.current, status: "active")

      job = create(:import_job,
        tenant: tenant,
        user: user,
        status: "completed",
        rollback_metadata: {
          "created_compensation_ids" => [ new_rec.id ],
          "superseded_compensation_ids" => [ old_rec.id ],
          "updated_employees" => [
            { "id" => emp.id, "previous" => { "job_title" => "Senior Engineer" } }
          ]
        }
      )

      described_class.call(job)

      expect(job.reload.status).to eq("rolled_back")
      expect(tenant.compensation_records.find_by(id: new_rec.id)).to be_nil
      expect(old_rec.reload.status).to eq("active")
      expect(emp.reload.job_title).to eq("Senior Engineer")
    end

    it "sets status to 'cancelled' when rolling back a job cancelled while processing" do
      emp = create(:employee, tenant: tenant, domain: domain, employee_number: "PARTIAL_EMP")

      job = create(:import_job,
        tenant: tenant,
        user: user,
        status: "cancelling",
        rollback_metadata: {
          "created_employee_ids" => [ emp.id ]
        }
      )

      described_class.call(job)

      expect(job.reload.status).to eq("cancelled")
      expect(tenant.employees.find_by(id: emp.id)).to be_nil
    end
  end
end
