require 'json'

# This script acts as the "glue" for high-level tasks.
# It can orchestrate between the Hono API, Python services, and Rust/Zig modules.

def summarize_shapes(data_dir)
  puts "🔍 Analyzing shapes in #{data_dir}..."
  files = Dir.glob(File.join(data_dir, "*.json"))
  
  summary = files.map do |file|
    data = JSON.parse(File.read(file))
    {
      file: File.basename(file),
      points: data.is_a?(Array) ? data.size : (data['geometry'] ? data['geometry']['coordinates'].size : 'unknown')
    }
  end

  puts "✅ Summary complete:"
  summary.each { |s| puts "- #{s[:file]}: #{s[:points]} points" }
end

REQUIRED_KEYS = %w[
  VITE_MAPBOX_ACCESS_TOKEN
  OPENAI_API_KEY
  BACKEND_URL
]

def check_env
  puts "🛡️  Checking environment..."
  missing = REQUIRED_KEYS.select { |key| ENV[key].nil? || ENV[key].empty? }
  
  if missing.any?
    puts "❌ Missing required keys in .env: #{missing.join(', ')}"
    puts "💡 Hint: Copy .env.example to .env and fill in the values."
    return false
  end
  
  puts "✅ Environment looks good."
  true
end

if __FILE__ == $0
  check_env
  summarize_shapes('backend/data')
end
