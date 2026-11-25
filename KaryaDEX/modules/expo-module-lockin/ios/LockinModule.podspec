Pod::Spec.new do |s|
  s.name         = 'LockinModule'
  s.version      = '0.1.0'
  s.summary      = 'LOCKIN native module for KaryaDEX'
  s.description  = 'iOS stub for LOCKIN Expo module'
  s.homepage     = 'https://github.com/Cartinem-DEV/KaryaDEX'
  s.license      = 'MIT'
  s.author       = { 'KaryaDEX Contributors' => 'saikatroy.offi@gmail.com' }
  s.platform     = :ios, '15.0'
  s.source       = { :git => '' }
  s.source_files = '*.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks   = 'FamilyControls', 'ManagedSettings', 'ScreenTime'
  s.swift_version = '5.9'
end
