# frozen_string_literal: true

require "sidekiq/api"

class HealthController < ApplicationController
  # GET /health/live (HEALTH-01)
  # Liveness: fast check — process is alive.
  # Must NOT depend on database (avoids restart loops on DB outage).
  def live
    render json: { status: "ok" }, status: :ok
  end

  # GET /health/ready (HEALTH-02)
  # Readiness: bounded check of critical dependencies.
  # Used by ALB target group health check.
  def ready
    ActiveRecord::Base.connection.execute("SELECT 1")
    redis_alive = begin
      Sidekiq.redis { |conn| conn.ping == "PONG" }
    rescue StandardError
      false
    end

    if redis_alive
      render json: { status: "ok", database: "connected", redis: "connected" }, status: :ok
    else
      render json: { status: "degraded", database: "connected", redis: "unavailable" }, status: :service_unavailable
    end
  rescue StandardError => e
    render json: { status: "error", error: e.message }, status: :service_unavailable
  end

  # GET /health/workers (HEALTH-03)
  # Worker health: worker heartbeat, queue latency and retry/failure metrics
  def workers
    stats = Sidekiq::Stats.new
    processes = Sidekiq::ProcessSet.new

    render json: {
      status: "ok",
      active_workers: processes.size,
      processed_jobs: stats.processed,
      failed_jobs: stats.failed,
      enqueued_jobs: stats.enqueued,
      default_latency_seconds: Sidekiq::Queue.new("default").latency.round(2),
      imports_latency_seconds: Sidekiq::Queue.new("imports").latency.round(2),
      exports_latency_seconds: Sidekiq::Queue.new("exports").latency.round(2),
      queues: stats.queues
    }, status: :ok
  rescue StandardError => e
    render json: { status: "error", message: e.message }, status: :service_unavailable
  end
end
