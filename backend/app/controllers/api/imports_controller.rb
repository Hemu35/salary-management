module Api
  class ImportsController < BaseController
    # POST /api/imports
    def create
      file = params[:file]
      if file.blank?
        return render json: { error: "No CSV file provided" }, status: :unprocessable_entity
      end

      filename = file.original_filename
      unless filename.to_s.downcase.end_with?(".csv")
        return render json: { error: "File must be a CSV (.csv)" }, status: :unprocessable_entity
      end

      storage_dir = Rails.root.join("storage", "imports", "tenant_#{current_tenant.id}")
      FileUtils.mkdir_p(storage_dir)

      timestamp = Time.current.strftime("%Y%m%d%H%M%S")
      sanitized_filename = File.basename(filename).gsub(/[^a-zA-Z0-9.\-_]/, "_")
      file_path = storage_dir.join("#{timestamp}_#{sanitized_filename}").to_s

      File.open(file_path, "wb") do |f|
        f.write(file.read)
      end

      job = nil
      with_tenant_context do
        job = current_tenant.import_jobs.create!(
          user: current_user,
          filename: filename,
          file_path: file_path,
          status: "queued"
        )
      end

      ::ImportJobWorker.perform_async(job.id)

      render json: serialize_job(job), status: :accepted
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
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at
      }
    end
  end
end
