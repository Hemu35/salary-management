Rails.application.routes.draw do
  # Health checks — liveness must not require auth (used by ECS/ALB)
  get "/health/live",    to: "health#live"
  get "/health/ready",   to: "health#ready"
  get "/health/workers", to: "health#workers"

  namespace :api do
    # Authentication
    resource :session, only: [ :create, :show, :destroy ]

    # Employee management (tenant + domain scoped)
    resources :employees, only: [ :index, :create, :show, :update ] do
      resources :compensation, only: [ :index, :create, :update ], controller: "compensations"
    end

    # Async CSV import
    resources :imports, only: [ :index, :create, :show ] do
      member do
        post :cancel
        post :rollback
      end
    end

    # Async CSV export
    resources :exports, only: [ :index, :create, :show ] do
      member { get :download }
    end

    # Analytics / Reports
    namespace :reports do
      get :workforce
      get :compensation
    end
  end
end
