# CORS configuration — allows React frontend (port 3000/5173) to call Rails API (port 3001)
# HR Manager browser-based web app; same-origin session cookies require explicit CORS setup.

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(
      "http://localhost:3000",   # React frontend (Docker / production build)
      "http://localhost:5173",   # Vite dev server
      ENV.fetch("FRONTEND_URL", "http://localhost:3000")
    )

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ],
      credentials: true  # Required for session cookie auth
  end
end
