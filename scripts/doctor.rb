require 'json'
require 'set'

# Ghost Tracks System Doctor & Env Discovery
# This script scans the codebase to find every env key you actually need.

def discover_keys
  puts "🔍 Scanning codebase for environment variables..."
  keys = Set.new
  
  # Search patterns for different runtimes
  patterns = {
    "Svelte/Vite" => /VITE_[A-Z0-9_]+/,
    "Python"      => /os\.getenv\(['"]([A-Z0-9_]+)['"]\)/,
    "Bun/Hono"    => /process\.env\.([A-Z0-9_]+)/
  }

  Dir.glob("**/*.{ts,js,svelte,py}").each do |file|
    next if file.include?('node_modules') || file.include?('venv')
    content = File.read(file)
    
    # Simple regex discovery
    keys.merge(content.scan(/VITE_[A-Z0-9_]+/).flatten)
    keys.merge(content.scan(/os\.getenv\(['"]([A-Z0-9_]+)['"]\)/).flatten)
    keys.merge(content.scan(/process\.env\.([A-Z0-9_]+)/).flatten)
    # Also check env.BACKEND_URL style in SvelteKit
    keys.merge(content.scan(/env\.([A-Z0-9_]+)/).flatten)
  end
  
  keys.to_a.sort
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
