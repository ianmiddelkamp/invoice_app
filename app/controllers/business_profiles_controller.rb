class BusinessProfilesController < ApplicationController
  def show
    render json: BusinessProfile.instance
  end

  def update
    profile = BusinessProfile.instance
    if profile.update(business_profile_params)
      render json: profile
    else
      render json: { errors: profile.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def business_profile_params
    params.require(:business_profile).permit(
      :name, :email, :phone,
      :address1, :address2, :city, :state, :postcode, :country,
      :hst_number
    )
  end
end
