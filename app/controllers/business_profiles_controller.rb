class BusinessProfilesController < ApplicationController
  def show
    render json: profile_json(BusinessProfile.instance)
  end

  def update
    profile = BusinessProfile.instance
    if profile.update(business_profile_params)
      render json: profile_json(profile)
    else
      render json: { errors: profile.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update_logo
    profile = BusinessProfile.instance
    profile.logo.attach(params[:logo])
    render json: { logo_data_uri: profile.logo_data_uri }
  end

  def destroy_logo
    profile = BusinessProfile.instance
    profile.logo.purge
    render json: { logo_data_uri: nil }
  end

  private

  def business_profile_params
    params.require(:business_profile).permit(
      :name, :email, :phone,
      :address1, :address2, :city, :state, :postcode, :country,
      :hst_number, :primary_color, :invoice_footer, :estimate_footer,
      :default_payment_terms
    )
  end

  def profile_json(profile)
    profile.as_json.merge(logo_data_uri: profile.logo_data_uri)
  end
end
