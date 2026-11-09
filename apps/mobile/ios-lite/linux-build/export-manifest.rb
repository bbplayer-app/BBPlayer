# Dumps the Release build graph of Pods.xcodeproj to JSON for the Linux build driver.
require 'xcodeproj'
require 'json'
pods_dir, out = ARGV
project = Xcodeproj::Project.open(File.join(pods_dir, 'Pods.xcodeproj'))
def phase_files(phase)
  return [] unless phase
  phase.files.map do |f|
    next unless f.file_ref
    path = begin f.file_ref.real_path.to_s rescue nil end
    { path: path, name: f.file_ref.display_name, settings: f.settings || {}, isa: f.file_ref.isa }
  end.compact
end
targets = project.targets.map do |t|
  cfg = t.build_configurations.find { |c| c.name == 'Release' }
  h = {
    name: t.name, isa: t.isa,
    product_name: (t.product_name rescue nil),
    product_type: (t.respond_to?(:product_type) ? t.product_type : nil),
    settings: cfg.build_settings,
    xcconfig: (cfg.base_configuration_reference ? cfg.base_configuration_reference.real_path.to_s : nil),
    deps: t.dependencies.map { |d| d.target ? d.target.name : d.name }.compact,
  }
  if t.respond_to?(:source_build_phase)
    h[:sources] = phase_files(t.source_build_phase)
    h[:headers] = phase_files(t.headers_build_phase)
    h[:resources] = phase_files(t.resources_build_phase)
    h[:frameworks] = phase_files(t.frameworks_build_phase).map { |f| f[:name] }
  end
  h[:copy_files] = t.copy_files_build_phases.map { |p| { name: p.name, dst_path: p.dst_path, spec: p.symbol_dst_subfolder_spec, files: phase_files(p) } } if t.respond_to?(:copy_files_build_phases)
  h[:scripts] = t.shell_script_build_phases.map { |p| { name: p.name, script: p.shell_script, inputs: p.input_paths, outputs: p.output_paths, input_lists: p.input_file_list_paths, output_lists: p.output_file_list_paths } } if t.respond_to?(:shell_script_build_phases)
  h
end
proj = project.build_configurations.find { |c| c.name == 'Release' }
File.write(out, JSON.pretty_generate({ project_settings: proj.build_settings, targets: targets }))
puts "targets: #{targets.size}"
