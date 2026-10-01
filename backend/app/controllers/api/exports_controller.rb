module Api
  class ExportsController < BaseController
    # GET /api/exports
    def index
      jobs = []
      with_tenant_context do
        scope = current_tenant.export_jobs.recent_first
        scope = scope.where(user_id: current_user.id) if current_user.hr_manager?
        jobs = scope.limit(20)
      end

      render json: { export_jobs: jobs.map { |job| serialize_job(job) } }
    end

    # POST /api/exports
    def create
      requested_domain_id = params[:domain_id].presence
      if requested_domain_id.present? && requested_domain_id != "all"
        domain_id_int = requested_domain_id.to_i
        if current_user.hr_manager? && !current_user.accessible_domain_ids.include?(domain_id_int)
          return render json: { error: "Forbidden: You are not authorized to export data for this domain." }, status: :forbidden
        end
      end

      employee_ids = Array.wrap(params[:employee_ids]).map(&:to_i).reject(&:zero?)

      filter_params = {
        "domain_id" => requested_domain_id,
        "employment_status" => params[:employment_status].presence,
        "search" => params[:search].presence,
        "employee_ids" => employee_ids.presence
      }.compact

      timestamp = Time.current.strftime("%Y%m%d_%H%M%S")
      filename = if employee_ids.any?
                   "employees_export_selected_#{employee_ids.length}_#{timestamp}.csv"
                 else
                   "employees_export_#{timestamp}.csv"
                 end

      job = nil
      with_tenant_context do
        job = current_tenant.export_jobs.create!(
          user: current_user,
          filename: filename,
          filters: filter_params,
          status: "queued"
        )
      end

      ::ExportJobWorker.perform_async(job.id)

      render json: serialize_job(job), status: :accepted
    end

    # GET /api/exports/:id
    def show
      job = nil
      with_tenant_context do
        job = current_tenant.export_jobs.find(params[:id])
      end

      if current_user.hr_manager? && job.user_id != current_user.id
        return render json: { error: "Forbidden" }, status: :forbidden
      end

      render json: serialize_job(job)
    end

    # GET /api/exports/:id/download
    def download
      job = nil
      with_tenant_context do
        job = current_tenant.export_jobs.find(params[:id])
      end

      if current_user.hr_manager? && job.user_id != current_user.id
        return render json: { error: "Forbidden" }, status: :forbidden
      end

      unless job.completed?
        return render json: { error: "Export is not ready for download (status: #{job.status})" }, status: :bad_request
      end

      if job.expired?
        return render json: { error: "Export file has expired" }, status: :gone
      end

      unless job.file_path.present? && File.exist?(job.file_path)
        return render json: { error: "Export file not found on disk" }, status: :not_found
      end

      send_file(
        job.file_path,
        filename: job.filename,
        type: "text/csv; charset=utf-8",
        disposition: "attachment"
      )
    end

    private

    def serialize_job(job)
      {
        id: job.id,
        filename: job.filename,
        status: job.status,
        filters: job.filters,
        total_rows: job.total_rows,
        processed_rows: job.processed_rows,
        progress_percentage: job.progress_percentage,
        can_download: job.can_download?,
        download_url: job.can_download? ? "/api/exports/#{job.id}/download" : nil,
        error_message: job.error_message,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        expires_at: job.expires_at
      }
    end
  end
end
