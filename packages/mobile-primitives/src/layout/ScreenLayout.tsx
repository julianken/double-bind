/**
 * ScreenLayout - Standard screen template component
 *
 * Provides a consistent layout structure for screens with:
 * - Safe area handling
 * - Responsive content container
 * - Optional header and footer
 * - Scroll support
 * - Loading and error states
 */

import * as React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ViewStyle,
  StyleProp,
  RefreshControl,
  ActivityIndicator,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeArea } from './SafeArea';
import type { SafeAreaEdges } from './SafeArea';
import { ResponsiveContainer } from './ResponsiveContainer';
import { useDeviceOrientation } from './useDeviceOrientation';

/**
 * Props for ScreenLayout component
 */
export interface ScreenLayoutProps {
  /** Screen content */
  children: React.ReactNode;
  /** Optional header component (rendered above content) */
  header?: React.ReactNode;
  /** Optional footer component (rendered below content) */
  footer?: React.ReactNode;
  /** Screen title (for accessibility) */
  title?: string;
  /** Background color */
  backgroundColor?: string;
  /** Whether content should be scrollable */
  scrollable?: boolean;
  /** Whether to show pull-to-refresh */
  refreshing?: boolean;
  /** Callback when pull-to-refresh is triggered */
  onRefresh?: () => void;
  /** Whether screen is in loading state */
  loading?: boolean;
  /** Loading message to display */
  loadingMessage?: string;
  /** Error message to display */
  error?: string | null;
  /** Callback to retry after error */
  onRetry?: () => void;
  /** Safe area edges to apply */
  edges?: SafeAreaEdges;
  /** Additional style for the container */
  style?: StyleProp<ViewStyle>;
  /** Additional style for the content area */
  contentStyle?: StyleProp<ViewStyle>;
  /** Whether to apply responsive padding to content */
  responsivePadding?: boolean;
  /** Whether to center content on large screens */
  centerContent?: boolean;
  /** Whether to enable keyboard avoiding behavior */
  keyboardAvoiding?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * ScreenLayout provides a standardized screen structure.
 *
 * Features:
 * - Automatic safe area handling
 * - Optional scrollable content
 * - Pull-to-refresh support
 * - Loading and error states
 * - Responsive content padding
 * - Header and footer slots
 * - Keyboard avoiding behavior
 *
 * @example
 * ```tsx
 * // Basic screen
 * <ScreenLayout title="Home">
 *   <HomeContent />
 * </ScreenLayout>
 *
 * // Scrollable screen with header
 * <ScreenLayout
 *   title="Pages"
 *   header={<PageListHeader />}
 *   scrollable
 *   refreshing={isRefreshing}
 *   onRefresh={handleRefresh}
 * >
 *   <PageList />
 * </ScreenLayout>
 *
 * // Screen with loading state
 * <ScreenLayout title="Details" loading={isLoading}>
 *   <DetailsContent />
 * </ScreenLayout>
 * ```
 */
export function ScreenLayout({
  children,
  header,
  footer,
  title: _title,
  backgroundColor = '#F2F2F7',
  scrollable = false,
  refreshing = false,
  onRefresh,
  loading = false,
  loadingMessage = 'Loading...',
  error = null,
  onRetry,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
  contentStyle,
  responsivePadding = true,
  centerContent = false,
  keyboardAvoiding = false,
  testID,
}: ScreenLayoutProps): React.ReactElement {
  const { isTablet } = useDeviceOrientation();

  // Render loading state
  if (loading) {
    return (
      <SafeArea edges={edges} backgroundColor={backgroundColor} testID={testID}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      </SafeArea>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeArea edges={edges} backgroundColor={backgroundColor} testID={testID}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          {onRetry && (
            <Text style={styles.retryButton} onPress={onRetry}>
              Tap to retry
            </Text>
          )}
        </View>
      </SafeArea>
    );
  }

  // Build the main content
  const mainContent = (
    <>
      {header}
      {responsivePadding ? (
        <ResponsiveContainer
          centerContent={centerContent && isTablet}
          style={[styles.content, contentStyle]}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
      {footer}
    </>
  );

  // Wrap in scroll view if needed
  const scrollableContent = scrollable ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        ) : undefined
      }
    >
      {mainContent}
    </ScrollView>
  ) : (
    <View style={styles.nonScrollContent}>{mainContent}</View>
  );

  // Wrap in keyboard avoiding view if needed
  const keyboardContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {scrollableContent}
    </KeyboardAvoidingView>
  ) : (
    scrollableContent
  );

  return (
    <SafeArea edges={edges} backgroundColor={backgroundColor} style={style} testID={testID}>
      {keyboardContent}
    </SafeArea>
  );
}

/**
 * Props for TabletLayout component
 */
export interface TabletLayoutProps {
  /** Sidebar content (shown on tablets) */
  sidebar?: React.ReactNode;
  /** Main content area */
  children: React.ReactNode;
  /** Sidebar width (default: 320) */
  sidebarWidth?: number;
  /** Whether to show sidebar on landscape only */
  landscapeOnly?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Safe area edges to apply */
  edges?: SafeAreaEdges;
  /** Test ID for testing */
  testID?: string;
}

/**
 * TabletLayout provides a master-detail layout for tablets.
 *
 * Features:
 * - Sidebar + main content on tablets
 * - Collapses to single column on phones
 * - Optional landscape-only sidebar
 *
 * @example
 * ```tsx
 * <TabletLayout sidebar={<PageList />}>
 *   <PageDetail />
 * </TabletLayout>
 * ```
 */
export function TabletLayout({
  sidebar,
  children,
  sidebarWidth = 320,
  landscapeOnly = false,
  backgroundColor = '#F2F2F7',
  edges = ['top', 'right', 'bottom', 'left'],
  testID,
}: TabletLayoutProps): React.ReactElement {
  const { isTablet, isLandscape } = useDeviceOrientation();

  const showSidebar = isTablet && sidebar && (!landscapeOnly || isLandscape);

  return (
    <SafeArea edges={edges} backgroundColor={backgroundColor} testID={testID}>
      <View style={styles.tabletContainer}>
        {showSidebar && <View style={[styles.sidebar, { width: sidebarWidth }]}>{sidebar}</View>}
        <View style={styles.mainContent}>{children}</View>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  nonScrollContent: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 16,
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: 'center',
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FF3B30',
    overflow: 'hidden',
  },
  errorText: {
    fontSize: 16,
    color: '#3C3C43',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  tabletContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#C6C6C8',
    backgroundColor: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },
});
