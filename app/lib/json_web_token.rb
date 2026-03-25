module JsonWebToken
  SECRET = Rails.application.secret_key_base
  EXPIRY = 24.hours

  def self.encode(payload)
    payload[:exp] = EXPIRY.from_now.to_i
    JWT.encode(payload, SECRET, "HS256")
  end

  def self.decode(token)
    decoded = JWT.decode(token, SECRET, true, algorithm: "HS256")
    HashWithIndifferentAccess.new(decoded.first)
  rescue JWT::DecodeError => e
    raise e
  end
end
