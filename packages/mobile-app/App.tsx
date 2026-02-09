/**
 * Double-Bind Mobile App
 *
 * This file demonstrates that monorepo package resolution is working correctly.
 * The imports from @double-bind/types and @double-bind/core should resolve
 * to the workspace packages via Metro's extraNodeModules configuration.
 */

import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// Test imports from monorepo packages
// These verify that Metro is correctly resolving workspace packages
import type { Page, Block, PageId, BlockId } from "@double-bind/types";
import { PageRepository, BlockRepository } from "@double-bind/core";

// Type check: ensure types are properly imported
const testPageId: PageId = "test-page-id" as PageId;
const testBlockId: BlockId = "test-block-id" as BlockId;

// Log to verify imports work at runtime
console.log("Monorepo imports verified:");
console.log("- PageRepository:", typeof PageRepository);
console.log("- BlockRepository:", typeof BlockRepository);
console.log("- Test PageId:", testPageId);
console.log("- Test BlockId:", testBlockId);

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Double-Bind</Text>
        <Text style={styles.subtitle}>Mobile App</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Monorepo Resolution:</Text>
          <Text style={styles.statusValue}>
            {PageRepository && BlockRepository ? "Working" : "Failed"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#eaeaea",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#a0a0a0",
    marginBottom: 32,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    padding: 16,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#a0a0a0",
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4ade80",
  },
});

export default App;
