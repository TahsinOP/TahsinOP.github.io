#!/usr/bin/env ruby --disable-gems
# Run a real Jekyll 3.10 build (the engine GitHub Pages uses) without
# RubyGems activation, so the native live-reload gems are not needed.
#   ruby --disable-gems tools/jekyll_build.rb [destination]
# Gems are expected in ~/.local/share/gem/ruby/<ver>/gems (gem install --user-install).
require "rbconfig"
ver  = RbConfig::CONFIG["ruby_version"]
gems = File.expand_path("~/.local/share/gem/ruby/#{ver}/gems")
NEEDED = %w[jekyll liquid kramdown kramdown-parser-gfm rouge safe_yaml mercenary colorator
            pathutil forwardable-extended addressable public_suffix i18n concurrent-ruby
            jekyll-sass-converter sass jekyll-sitemap webrick rexml]
NEEDED.each do |name|
  lib = Dir[File.join(gems, "#{name}-[0-9]*", "lib")].max
  abort "missing gem #{name}: gem install --user-install --ignore-dependencies #{name}" unless lib
  $LOAD_PATH.unshift(lib)
end
# stdlib gems shipped with Ruby that Jekyll's dependencies expect
%w[set json fileutils time pathname].each { |l| require l }
require "jekyll"
root = File.expand_path("..", __dir__)
dest = ARGV[0] || File.join(root, "_site")
Jekyll::Commands::Build.process("source" => root, "destination" => dest, "quiet" => false)
