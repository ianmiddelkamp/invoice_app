Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  resources :clients, except: [:destroy]
  delete "clients/:id", to: "clients#delete"

  resources :projects, except: [:destroy] do
    resources :time_entries, only: [:index, :create, :update]
  end
  delete "projects/:id", to: "projects#delete"
  delete "projects/:project_id/time_entries/:id", to: "time_entries#delete"
end
