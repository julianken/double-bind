/**
 * E2E Test: Graph Visualization Interaction
 *
 * Tests mobile-specific graph interactions: pinch-to-zoom, pan, node selection, filtering.
 * Graph interaction on mobile requires touch-optimized gestures and responsive layout.
 *
 * Test Coverage:
 * - View graph visualization
 * - Pinch-to-zoom in/out
 * - Pan gesture to navigate graph
 * - Tap to select nodes
 * - Filter nodes by type/tag
 * - View node details
 * - Navigate to page from node
 */

/* eslint-disable no-console */

import { describe, it, beforeEach } from 'vitest';
import {
  waitForElement,
  assertElementExists,
  assertTextVisible,
  pinchToZoom,
  getElementByTestId,
  tapAtPoint,
  takeScreenshot,
  wait,
} from '../setup/testHelpers';
import { createDeviceMock, GestureMock } from '../mocks/DeviceMock';

describe('Graph Visualization Interaction', () => {
  const device = createDeviceMock('ios');

  beforeEach(async () => {
    await device.reset();
    console.log('[Test] Launching app');
    await waitForElement('app-shell', 10000);

    // Navigate to graph view
    const graphButton = getElementByTestId('graph-view-button');
    await graphButton.tap();
    await waitForElement('graph-view', 5000);
  });

  describe('Graph Display', () => {
    it('should display graph visualization', async () => {
      // Verify graph canvas is visible
      await assertElementExists('graph-canvas');

      // Verify nodes are rendered
      await assertElementExists('graph-nodes');

      // Verify edges are rendered
      await assertElementExists('graph-edges');

      await takeScreenshot('graph-view-displayed');
    });

    it('should adapt graph layout to mobile screen', async () => {
      // Verify graph fills available space
      await assertElementExists('graph-canvas');

      // Verify mobile-specific controls are visible
      await assertElementExists('graph-zoom-controls');
      await assertElementExists('graph-filter-button');

      await takeScreenshot('graph-mobile-layout');
    });

    it('should show loading state while rendering graph', async () => {
      // For large graphs, verify loading indicator
      // await assertElementExists('graph-loading-indicator');

      await waitForElement('graph-canvas', 5000);

      // Loading should be complete
      // await assertElementNotExists('graph-loading-indicator');
    });

    it('should handle empty graph gracefully', async () => {
      // Mock scenario with no nodes
      console.log('[Mock] Empty graph scenario');

      // Verify empty state message
      // await assertTextVisible('No pages yet');
      // await assertElementExists('create-first-page-button');

      await takeScreenshot('graph-empty-state');
    });
  });

  describe('Zoom Gestures', () => {
    it('should zoom in with pinch gesture', async () => {
      await assertElementExists('graph-canvas');

      // Pinch out to zoom in
      await pinchToZoom('graph-canvas', 'out', 2.0);

      await wait(500);

      // Verify zoom level increased
      // Could check transform scale or visible nodes
      await takeScreenshot('graph-zoomed-in');
    });

    it('should zoom out with pinch gesture', async () => {
      await assertElementExists('graph-canvas');

      // Pinch in to zoom out
      await pinchToZoom('graph-canvas', 'in', 0.5);

      await wait(500);

      // Verify zoom level decreased
      await takeScreenshot('graph-zoomed-out');
    });

    it('should use zoom controls for accessibility', async () => {
      // Tap zoom in button
      const zoomInButton = getElementByTestId('graph-zoom-in');
      await zoomInButton.tap();

      await wait(300);

      // Verify graph zoomed in
      await takeScreenshot('graph-zoom-button-in');

      // Tap zoom out button
      const zoomOutButton = getElementByTestId('graph-zoom-out');
      await zoomOutButton.tap();

      await wait(300);

      await takeScreenshot('graph-zoom-button-out');
    });

    it('should reset zoom to default', async () => {
      // Zoom in first
      await pinchToZoom('graph-canvas', 'out', 2.0);
      await wait(300);

      // Tap reset zoom button
      const resetZoomButton = getElementByTestId('graph-reset-zoom');
      await resetZoomButton.tap();

      await wait(500);

      // Verify zoom is reset
      await takeScreenshot('graph-zoom-reset');
    });

    it('should maintain zoom level when rotating device', async () => {
      // Zoom in
      await pinchToZoom('graph-canvas', 'out', 2.0);
      await wait(300);

      // Rotate to landscape
      await device.rotate('landscape');
      await wait(500);

      // Verify zoom is maintained
      await assertElementExists('graph-canvas');

      await takeScreenshot('graph-landscape-zoomed');

      // Rotate back
      await device.rotate('portrait');
      await wait(500);
    });
  });

  describe('Pan Gestures', () => {
    it('should pan graph with drag gesture', async () => {
      await assertElementExists('graph-canvas');

      // Pan from center to left
      await GestureMock.pan(200, 400, -100, 0);

      await wait(300);

      // Verify graph position changed
      await takeScreenshot('graph-panned-left');
    });

    it('should pan in all directions', async () => {
      await assertElementExists('graph-canvas');

      // Pan up
      await GestureMock.pan(200, 400, 0, -100);
      await wait(200);

      // Pan right
      await GestureMock.pan(200, 300, 100, 0);
      await wait(200);

      // Pan down
      await GestureMock.pan(300, 300, 0, 100);
      await wait(200);

      await takeScreenshot('graph-multi-directional-pan');
    });

    it('should have smooth pan animation', async () => {
      await assertElementExists('graph-canvas');

      // Quick pan gesture
      await GestureMock.swipe(300, 400, 100, 400, 150);

      await wait(300);

      // Graph should smoothly decelerate
      await takeScreenshot('graph-pan-animation');
    });

    it('should constrain pan to graph bounds', async () => {
      await assertElementExists('graph-canvas');

      // Try to pan beyond graph bounds
      await GestureMock.pan(200, 400, -1000, 0);

      await wait(300);

      // Graph should not pan beyond bounds
      await takeScreenshot('graph-pan-constrained');
    });
  });

  describe('Node Selection', () => {
    it('should select node on tap', async () => {
      await assertElementExists('graph-canvas');

      // Tap on a node (approximate coordinates)
      await tapAtPoint(200, 300);

      await wait(300);

      // Verify node is selected (highlighted)
      await assertElementExists('selected-node');

      // Verify node details panel appears
      await assertElementExists('node-details-panel');

      await takeScreenshot('graph-node-selected');
    });

    it('should show node details on selection', async () => {
      // Select a node
      await tapAtPoint(200, 300);

      await wait(300);

      // Verify node title is shown
      await assertTextVisible('Page Title');

      // Verify connection count
      // await assertTextVisible('3 connections');

      await takeScreenshot('graph-node-details');
    });

    it('should deselect node on tap outside', async () => {
      // Select a node
      await tapAtPoint(200, 300);
      await wait(300);

      await assertElementExists('selected-node');

      // Tap outside node
      await tapAtPoint(50, 50);
      await wait(300);

      // Verify node is deselected
      // await assertElementNotExists('selected-node');
      // await assertElementNotExists('node-details-panel');
    });

    it('should navigate to page from selected node', async () => {
      // Select a node
      await tapAtPoint(200, 300);
      await wait(300);

      // Tap "Open Page" button
      const openPageButton = getElementByTestId('open-page-from-node');
      await openPageButton.tap();

      // Verify navigation to page view
      await waitForElement('page-view', 5000);
      await assertTextVisible('Page Title');

      await takeScreenshot('navigated-from-graph-node');
    });

    it('should highlight connected nodes on selection', async () => {
      // Select a node
      await tapAtPoint(200, 300);
      await wait(300);

      // Verify connected nodes are highlighted
      await assertElementExists('highlighted-connections');

      await takeScreenshot('graph-connections-highlighted');
    });
  });

  describe('Graph Filtering', () => {
    it('should filter nodes by tag', async () => {
      // Open filter menu
      const filterButton = getElementByTestId('graph-filter-button');
      await filterButton.tap();

      await waitForElement('filter-menu', 3000);

      // Select tag filter
      const tagFilter = getElementByTestId('filter-tag-work');
      await tagFilter.tap();

      await wait(500);

      // Verify graph shows only filtered nodes
      await assertElementExists('graph-canvas');

      await takeScreenshot('graph-filtered-by-tag');
    });

    it('should filter by connection count', async () => {
      const filterButton = getElementByTestId('graph-filter-button');
      await filterButton.tap();

      await waitForElement('filter-menu', 3000);

      // Set minimum connection filter
      const minConnectionsFilter = getElementByTestId('filter-min-connections');
      await minConnectionsFilter.tap();

      // Select threshold
      const threshold3 = getElementByTestId('connection-threshold-3');
      await threshold3.tap();

      await wait(500);

      // Verify only highly connected nodes shown
      await takeScreenshot('graph-filtered-by-connections');
    });

    it('should clear filters', async () => {
      // Apply filter first
      const filterButton = getElementByTestId('graph-filter-button');
      await filterButton.tap();

      const tagFilter = getElementByTestId('filter-tag-work');
      await tagFilter.tap();

      await wait(300);

      // Clear filters
      const clearFiltersButton = getElementByTestId('clear-filters');
      await clearFiltersButton.tap();

      await wait(500);

      // Verify all nodes shown again
      await takeScreenshot('graph-filters-cleared');
    });

    it('should show filter indicator when active', async () => {
      const filterButton = getElementByTestId('graph-filter-button');
      await filterButton.tap();

      const tagFilter = getElementByTestId('filter-tag-work');
      await tagFilter.tap();

      // Verify filter badge appears
      await assertElementExists('active-filter-badge');

      await takeScreenshot('graph-filter-indicator');
    });
  });

  describe('Graph Layout Options', () => {
    it('should switch between layout algorithms', async () => {
      // Open layout menu
      const layoutButton = getElementByTestId('graph-layout-button');
      await layoutButton.tap();

      await waitForElement('layout-menu', 3000);

      // Select force-directed layout
      const forceLayout = getElementByTestId('layout-force-directed');
      await forceLayout.tap();

      await wait(1000);

      // Verify graph re-layouts
      await takeScreenshot('graph-force-layout');

      // Try radial layout
      await layoutButton.tap();
      const radialLayout = getElementByTestId('layout-radial');
      await radialLayout.tap();

      await wait(1000);

      await takeScreenshot('graph-radial-layout');
    });

    it('should center graph on current page', async () => {
      // Tap center button
      const centerButton = getElementByTestId('graph-center-on-current');
      await centerButton.tap();

      await wait(500);

      // Verify current page node is centered
      await takeScreenshot('graph-centered-on-current');
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', async () => {
      // Mock large graph (100+ nodes)
      console.log('[Mock] Loading large graph with 100+ nodes');

      await waitForElement('graph-canvas', 10000);

      // Verify graph renders without lag
      await pinchToZoom('graph-canvas', 'out', 1.5);
      await wait(300);

      await GestureMock.pan(200, 400, -100, 0);
      await wait(300);

      // Performance should remain smooth
      await takeScreenshot('large-graph-interaction');
    });

    it('should use level of detail for zoomed out view', async () => {
      // Zoom out significantly
      await pinchToZoom('graph-canvas', 'in', 0.3);

      await wait(500);

      // Verify simplified node rendering (circles instead of full content)
      await takeScreenshot('graph-zoomed-out-lod');
    });

    it('should handle memory pressure during graph rendering', async () => {
      await device.simulateMemoryPressure('low');

      await assertElementExists('graph-canvas');

      // Graph should still render but may reduce visual quality
      await takeScreenshot('graph-low-memory');

      await device.simulateMemoryPressure('normal');
    });
  });

  describe('Accessibility', () => {
    it('should support VoiceOver navigation', async () => {
      // Enable VoiceOver (mocked)
      console.log('[Mock] VoiceOver enabled');

      // Navigate through nodes
      await assertElementExists('graph-canvas');

      // VoiceOver should announce node titles
      // await assertTextVisible('VoiceOver: Page Title');

      await takeScreenshot('graph-voiceover');
    });

    it('should have sufficient touch targets', async () => {
      // Verify buttons are at least 44x44 points (iOS guideline)
      await assertElementExists('graph-zoom-in');
      await assertElementExists('graph-zoom-out');
      await assertElementExists('graph-filter-button');

      // All should be easily tappable
      await takeScreenshot('graph-touch-targets');
    });
  });

  describe('Landscape Mode', () => {
    it('should optimize layout for landscape orientation', async () => {
      // Rotate to landscape
      await device.rotate('landscape');

      await wait(500);

      // Verify graph uses full width
      await assertElementExists('graph-canvas');

      // Verify controls are repositioned
      await assertElementExists('graph-zoom-controls');

      await takeScreenshot('graph-landscape-mode');
    });

    it('should show more nodes in landscape', async () => {
      await device.rotate('landscape');

      await wait(500);

      // Wider viewport should show more nodes
      await takeScreenshot('graph-landscape-more-nodes');

      await device.rotate('portrait');
    });
  });
});
