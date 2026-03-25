User.find_or_create_by!(email: "admin@example.com") do |u|
  u.name     = "Admin"
  u.password = "changeme"
end
