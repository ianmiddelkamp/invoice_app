Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  mount LetterOpenerWeb::Engine, at: "/letter_opener" if defined?(LetterOpenerWeb)

  post "/auth/login", to: "auth#login"

  resource :business_profile, only: [:show, :update]

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
    resource :rate, only: [:show, :update]
    resources :time_entries, only: [:index, :create, :update, :destroy]
  end
end
