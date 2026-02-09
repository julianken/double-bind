// packages/ui-primitives/vitest.config.ts
import { defineConfig } from "file:///Users/j/repos/double-bind/packages/wt-DBB-407-memory-management/node_modules/.pnpm/vitest@2.1.9_@types+node@25.2.1_jsdom@28.0.0_terser@5.46.0/node_modules/vitest/dist/config.js";
import react from "file:///Users/j/repos/double-bind/packages/wt-DBB-407-memory-management/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@6.4.1_@types+node@25.2.1_terser@5.46.0_tsx@4.21.0_yaml@2.8.2_/node_modules/@vitejs/plugin-react/dist/index.js";
var vitest_config_default = defineConfig({
  plugins: [react()],
  test: {
    name: "ui-primitives",
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicGFja2FnZXMvdWktcHJpbWl0aXZlcy92aXRlc3QuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2ovcmVwb3MvZG91YmxlLWJpbmQvcGFja2FnZXMvd3QtREJCLTQwNy1tZW1vcnktbWFuYWdlbWVudC9wYWNrYWdlcy91aS1wcmltaXRpdmVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvai9yZXBvcy9kb3VibGUtYmluZC9wYWNrYWdlcy93dC1EQkItNDA3LW1lbW9yeS1tYW5hZ2VtZW50L3BhY2thZ2VzL3VpLXByaW1pdGl2ZXMvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvai9yZXBvcy9kb3VibGUtYmluZC9wYWNrYWdlcy93dC1EQkItNDA3LW1lbW9yeS1tYW5hZ2VtZW50L3BhY2thZ2VzL3VpLXByaW1pdGl2ZXMvdml0ZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICB0ZXN0OiB7XG4gICAgbmFtZTogJ3VpLXByaW1pdGl2ZXMnLFxuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgaW5jbHVkZTogWyd0ZXN0LyoqLyoue3Rlc3Qsc3BlY30ue3RzLHRzeH0nXSxcbiAgICBzZXR1cEZpbGVzOiBbJ3Rlc3Qvc2V0dXAudHMnXSxcbiAgICBwb29sOiAnZm9ya3MnLFxuICAgIHBvb2xPcHRpb25zOiB7XG4gICAgICBmb3Jrczoge1xuICAgICAgICBzaW5nbGVGb3JrOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTJiLFNBQVMsb0JBQW9CO0FBQ3hkLE9BQU8sV0FBVztBQUVsQixJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsTUFBTTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsU0FBUyxDQUFDLGdDQUFnQztBQUFBLElBQzFDLFlBQVksQ0FBQyxlQUFlO0FBQUEsSUFDNUIsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUFBLE1BQ1gsT0FBTztBQUFBLFFBQ0wsWUFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
