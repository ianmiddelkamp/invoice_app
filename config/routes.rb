Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  mount LetterOpenerWeb::Engine, at: "/letter_opener" if defined?(LetterOpenerWeb)

  post "/auth/login", to: "auth#login"

  get    "/timer",       to: "timer_sessions#current"
  post   "/timer/start", to: "timer_sessions#start"
  post   "/timer/stop",  to: "timer_sessions#stop"
  patch  "/timer",       to: "timer_sessions#update"
  delete "/timer",       to: "timer_sessions#cancel"

  resource :business_profile, only: [:show, :update] do
    patch :update_logo
    delete :destroy_logo
  end

  resources :estimates, except: [:new, :edit] do
    member do
      get  :pdf
      post :regenerate_pdf
      post :send_estimate
    end
  end

  resources :invoices, except: [:new, :edit] do
    member do
      get  :pdf
      post :regenerate_pdf
      post :send_invoice
    end
  end

  resources :clients do
    resource :rate, only: [:show, :update]
  end
  resources :projects do
    member do
      post :sow_import, to: "sow_imports#create"
    end
    resource :rate, only: [:show, :update]
    resources :time_entries, only: [:index, :create, :update, :destroy]
    resources :attachments, only: [:index, :create, :show, :destroy],
                            controller: :project_attachments
    resources :task_groups, only: [:index, :create, :update, :destroy] do
      collection do
        patch :reorder
      end
      resources :tasks, only: [:create, :update, :destroy] do
        collection do
          patch :reorder
        end
      end
    end
  end
end
