require 'json'
require 'set'

# Ghost Tracks System Doctor & Env Discovery
# This script scans the codebase to find every env key you actually need.

# Tooling/CI vars that live in the shell or CI runner, never in the app's .env.
IGNORE = %w[CI NODE_ENV].to_set

def discover_keys
  puts "🔍 Scanning codebase for environment variables..."
  keys = Set.new

  Dir.glob("**/*.{ts,js,svelte,py}").each do |file|
    next if file.include?('node_modules') || file.include?('venv')
    next if file.end_with?('.config.ts', '.config.js') # test/build runner config
    content = File.read(file)

    # SvelteKit / Vite
    keys.merge(content.scan(/VITE_[A-Z0-9_]+/).flatten)
    keys.merge(content.scan(/(?:process\.)?env\.([A-Z0-9_]+)/).flatten)
    # Python: os.getenv('X'), os.environ.get('X'), os.environ['X']
    keys.merge(content.scan(/os\.(?:getenv|environ\.get)\(\s*['"]([A-Z0-9_]+)['"]/).flatten)
    keys.merge(content.scan(/os\.environ\[\s*['"]([A-Z0-9_]+)['"]\s*\]/).flatten)
  end

  (keys - IGNORE).to_a.sort
end

def check_system(discovered_keys)
  puts "\n🛡️  Ghost Tracks Environment Health Check"
  puts "=========================================="
  
  # Try to load .env manually if it exists to simulate what the apps will see
  env_file_vars = {}
  if File.exist?('.env')
    File.readlines('.env').each do |line|
      next if line.strip.empty? || line.start_with?('#')
      key, value = line.split('=', 2)
      env_file_vars[key.strip] = value&.strip if key
    end
  end

  missing = []
  discovered_keys.each do |key|
    # Check shell ENV or the .env file we just read
    status = (ENV[key] || env_file_vars[key]) ? "✅" : "❌"
    missing << key if status == "❌"
    printf("%-3s %-30s\n", status, key)
  end

  puts "=========================================="
  if missing.any?
    puts "💔 SYSTEM INCOMPLETE: #{missing.size} keys missing."
    puts "👉 Update your .env file at root with these keys to fix the app."
  else
    puts "🚀 SYSTEM READY: All discovered keys are present on this device."
  end
end

if __FILE__ == $0
  keys = discover_keys
  check_system(keys)
end
