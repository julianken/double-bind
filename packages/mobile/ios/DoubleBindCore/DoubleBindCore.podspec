Pod::Spec.new do |s|
  s.name             = 'DoubleBindCore'
  s.version          = '0.1.0'
  s.summary          = 'Core database layer for Double-Bind iOS app'
  s.description      = <<-DESC
    DoubleBindCore provides the native CozoDB integration for the Double-Bind
    note-taking application on iOS. It wraps CozoSwiftBridge to implement the
    GraphDB interface used across all Double-Bind platforms.
  DESC

  s.homepage         = 'https://github.com/double-bind/double-bind'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Double-Bind' => 'dev@double-bind.app' }
  s.source           = { :git => 'https://github.com/double-bind/double-bind.git', :tag => s.version.to_s }

  s.ios.deployment_target = '15.0'
  s.osx.deployment_target = '12.0'
  s.swift_version = '5.9'

  s.source_files = 'Sources/DoubleBindCore/**/*.swift'

  # CozoDB native database engine for iOS
  # Provides SQLite-backed Datalog database with graph algorithms
  s.dependency 'CozoSwiftBridge', '~> 0.7.1'
end
