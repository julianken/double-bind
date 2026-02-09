//
//  CozoModule.m
//  DoubleBindCore
//
//  Objective-C bridge for the CozoModule React Native native module.
//  This file registers the Swift implementation with React Native.
//

#import <React/RCTBridgeModule.h>

/// Objective-C interface declaration for the CozoModule.
/// The actual implementation is in CozoModule.swift.
@interface RCT_EXTERN_MODULE(CozoModule, NSObject)

// MARK: - Initialization

/// Initialize the database with the specified path.
/// Uses SQLite storage engine for mobile.
/// @param path - Absolute path to the database file
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(initialize:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Close the database and release all resources.
/// After calling this, the module must be re-initialized before use.
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(close:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// MARK: - Core Operations

/// Execute a Datalog script (query or mutation).
/// @param script - The Datalog script to execute
/// @param params - JSON string of query parameters
/// @param resolve - Promise resolve callback returning JSON result string
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(run:(NSString *)script
                  params:(NSString *)params
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Export specified relations as JSON.
/// @param relations - JSON array string of relation names
/// @param resolve - Promise resolve callback returning JSON result string
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(exportRelations:(NSString *)relations
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Import data into relations from JSON.
/// @param data - JSON object string mapping relation names to row arrays
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(importRelations:(NSString *)data
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// MARK: - Backup and Restore

/// Create a backup of the database.
/// @param path - File path for the backup
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(backup:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Restore the database from a backup file.
/// @param path - File path to the backup
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(restore:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Import specific relations from a backup file.
/// @param path - File path to the backup
/// @param relations - JSON array string of relation names to import
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(importRelationsFromBackup:(NSString *)path
                  relations:(NSString *)relations
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// MARK: - Mobile Lifecycle

/// Called when app transitions to background.
/// Flushes pending writes and prepares for suspension.
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(suspend:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Called when app returns to foreground.
/// Refreshes connections and validates database state.
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(resume:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

/// Called when system signals memory pressure.
/// Releases non-essential caches and resources.
/// @param resolve - Promise resolve callback
/// @param reject - Promise reject callback
RCT_EXTERN_METHOD(onLowMemory:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// MARK: - Module Configuration

/// Specifies that this module should not be initialized on the main thread.
/// Database operations are performed on a background queue.
+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end
