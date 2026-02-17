//
//  DatabaseModule.m
//  DoubleBindCore
//
//  React Native bridge for DatabaseModule.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DatabaseModule, NSObject)

RCT_EXTERN_METHOD(getDatabasePath:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(ensureDatabaseDirectory:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
