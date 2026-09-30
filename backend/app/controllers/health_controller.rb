class HealthController < ApplicationController
  # GET /health/live
  # Liveness: fast check — process is alive.
  # Must NOT depend on database (avoids restart loops on DB outage).
  def live
    render json: { status: "ok" }, status: :ok
  end

  # GET /health/ready
  # Readiness: bounded check of critical dependencies.
  # Used by ALB target group health check.
  def ready
    ActiveRecord::Base.connection.execute("SELECT 1")
    render json: { status: "ok", database: "connected" }, status: :ok
  rescue => e
    render json: { status: "error", database: e.message }, status: :service_unavailable
  end
end
