// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "DoubleBindCore",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "DoubleBindCore",
            targets: ["DoubleBindCore"]
        )
    ],
    dependencies: [
        // CozoSwiftBridge provides the CozoDB Swift bindings
        // Note: In production, this would be added via CocoaPods or SPM
        // pod 'CozoSwiftBridge', '~> 0.7.1'
    ],
    targets: [
        .target(
            name: "DoubleBindCore",
            dependencies: [],
            path: "Sources",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        )
    ]
)
