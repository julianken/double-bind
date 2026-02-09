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
        ),
    ],
    dependencies: [
        // CozoSwiftBridge is installed via CocoaPods, not SPM
        // See Podfile for dependency configuration
    ],
    targets: [
        .target(
            name: "DoubleBindCore",
            dependencies: [],
            path: "Sources/DoubleBindCore"
        ),
        .testTarget(
            name: "DoubleBindCoreTests",
            dependencies: ["DoubleBindCore"],
            path: "Tests/DoubleBindCoreTests"
        ),
    ]
)
