require "rails_helper"

RSpec.describe "Health endpoints", type: :request do
  describe "GET /health/live (HEALTH-01)" do
    it "returns 200 without hitting the database" do
      # Simulate DB unavailable by breaking the connection pool
      allow(ActiveRecord::Base).to receive(:connection).and_raise(ActiveRecord::ConnectionNotEstablished)
      get "/health/live"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["status"]).to eq("ok")
    end

    it "does not require authentication" do
      get "/health/live"
      expect(response).to have_http_status(:ok)
    end
  end

  describe "GET /health/ready (HEALTH-02)" do
    it "returns 200 when DB is available" do
      get "/health/ready"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("ok")
      expect(body["database"]).to eq("connected")
    end

    it "returns 503 when DB is unavailable" do
      allow(ActiveRecord::Base.connection).to receive(:execute).and_raise(ActiveRecord::StatementInvalid)
      get "/health/ready"
      expect(response).to have_http_status(:service_unavailable)
      expect(JSON.parse(response.body)["status"]).to eq("error")
    end
  end
end
