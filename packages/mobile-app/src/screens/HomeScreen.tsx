/**
 * HomeScreen - Main dashboard/daily notes screen
 *
 * Entry point for the app showing:
 * - Today's daily note (quick access)
 * - Recent pages
 * - Quick actions
 * - FAB for creating new pages
 */

import { useState, useCallback, type ReactElement } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FloatingActionButton, NewPageModal } from '@double-bind/mobile-primitives';
import type { HomeStackScreenProps } from '../navigation/types';
import { useCreatePage } from '../hooks/useCreatePage';

type Props = HomeStackScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props): ReactElement {
  const { createPage, isCreating } = useCreatePage();

  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleCreatePage = useCallback(
    async (title: string) => {
      const result = await createPage(title);

      if (result.error) {
        setCreateError(result.error.message);
        return; // Keep modal open
      }

      if (result.page) {
        setCreateError(null);
        setShowNewPageModal(false);
        // Navigate to the new page using the root modal
        navigation.navigate('PageDetail', { pageId: result.page.pageId });
      }
    },
    [createPage, navigation]
  );

  const handleCloseModal = useCallback(() => {
    setShowNewPageModal(false);
    setCreateError(null);
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowNewPageModal(true);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Double Bind</Text>
        <Text style={styles.subtitle}>Your graph-native note-taking app</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('DailyNote', { date: today })}
          accessibilityRole="button"
          accessibilityLabel="Open today's daily note"
        >
          <Text style={styles.buttonText}>Today&apos;s Daily Note</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Pages</Text>
          <Text style={styles.placeholder}>No recent pages yet</Text>
        </View>
      </View>

      <FloatingActionButton
        icon="+"
        onPress={handleOpenModal}
        accessibilityLabel="Create new page"
        testID="home-screen-fab"
      />

      <NewPageModal
        visible={showNewPageModal}
        onClose={handleCloseModal}
        onSubmit={handleCreatePage}
        isLoading={isCreating}
        error={createError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
