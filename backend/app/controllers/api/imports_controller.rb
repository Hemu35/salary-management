module Api
  class ImportsController < BaseController
    # GET /api/imports
    def index
      jobs = []
      with_tenant_context do
        jobs = current_tenant.import_jobs.recent_first.limit(20)
      end

      render json: { import_jobs: jobs.map { |job| serialize_job(job) } }
    end

    # POST /api/imports
    def create
      uploaded_files = Array.wrap(params[:files].presence || params[:file]).compact
      if uploaded_files.empty?
        return render json: { error: "No CSV file provided" }, status: :unprocessable_entity
      end

      non_csv = uploaded_files.any? { |f| !f.original_filename.to_s.downcase.end_with?(".csv") }
      if non_csv
        return render json: { error: "File must be a CSV (.csv)" }, status: :unprocessable_entity
      end

      storage_dir = Rails.root.join("storage", "imports", "tenant_#{current_tenant.id}")
      FileUtils.mkdir_p(storage_dir)

      created_jobs = []
      uploaded_files.each do |file|
        timestamp = Time.current.strftime("%Y%m%d%H%M%S%L")
        sanitized_filename = File.basename(file.original_filename).gsub(/[^a-zA-Z0-9.\-_]/, "_")
        file_path = storage_dir.join("#{timestamp}_#{sanitized_filename}").to_s

        File.open(file_path, "wb") do |f|
          f.write(file.read)
        end

        job = nil
        with_tenant_context do
          job = current_tenant.import_jobs.create!(
            user: current_user,
            filename: file.original_filename,
            file_path: file_path,
            status: "queued"
          )
        end

        ::ImportJobWorker.perform_async(job.id)
        created_jobs << job
      end

      if created_jobs.length == 1 && params[:file].present?
        render json: serialize_job(created_jobs.first), status: :accepted
      else
        render json: {
          jobs: created_jobs.map { |j| serialize_job(j) },
          count: created_jobs.length
        }, status: :accepted
      end
    end

    # GET /api/imports/:id
    def show
      job = nil
      with_tenant_context do
        job = current_tenant.import_jobs.find_by(id: params[:id])
      end

      if job.nil?
        return render json: { error: "Import job not found" }, status: :not_found
      end

      render json: serialize_job(job)
    end

    # POST /api/imports/:id/cancel
    def cancel
      job = nil
      with_tenant_context do
        job = current_tenant.import_jobs.find_by(id: params[:id])
      end

      return render json: { error: "Import job not found" }, status: :not_found unless job

      unless current_user.organization_admin? || job.user_id == current_user.id
        return render json: { error: "Access denied" }, status: :forbidden
      end

      if job.queued?
        with_tenant_context do
          job.update!(status: "cancelled", completed_at: Time.current)
        end
        render json: { message: "Import job successfully cancelled", import_job: serialize_job(job) }
      elsif job.processing?
        with_tenant_context do
          job.update!(status: "cancelling")
        end
        render json: { message: "Import cancellation initiated", import_job: serialize_job(job) }
      else
        render json: { error: "Cannot cancel job in '#{job.status}' status" }, status: :unprocessable_entity
      end
    end

    # POST /api/imports/:id/rollback
    def rollback
      job = nil
      with_tenant_context do
        job = current_tenant.import_jobs.find_by(id: params[:id])
      end

      return render json: { error: "Import job not found" }, status: :not_found unless job

      unless current_user.organization_admin? || job.user_id == current_user.id
        return render json: { error: "Access denied" }, status: :forbidden
      end

      if job.can_rollback?
        ImportRollbackService.call(job)
        render json: { message: "Import successfully rolled back", import_job: serialize_job(job.reload) }
      else
        render json: { error: "Cannot rollback job in '#{job.status}' status" }, status: :unprocessable_entity
      end
    end

    private

    def serialize_job(job)
      {
        id: job.id,
        status: job.status,
        filename: job.filename,
        total_rows: job.total_rows,
        processed_rows: job.processed_rows,
        successful_rows: job.successful_rows,
        failed_rows: job.failed_rows,
        progress_percentage: job.progress_percentage,
        error_summary: job.error_summary,
        can_cancel: job.can_cancel?,
        can_rollback: job.can_rollback?,
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at
      }
    end
  end
end
