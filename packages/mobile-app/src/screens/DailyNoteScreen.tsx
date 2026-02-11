/**
 * DailyNoteScreen - Daily note view with date navigation
 *
 * Shows the daily note for a specific date with:
 * - Current date display
 * - Previous/next day navigation (44px touch targets)
 * - Date picker for jumping to any date
 * - Auto-creation of daily notes if they don't exist
 */

import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import type { HomeStackScreenProps } from '../navigation/types';
import { useDailyNote } from '../hooks/useDailyNote';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

type Props = HomeStackScreenProps<'DailyNote'>;

/**
 * Format a date string for display (e.g., "February 9, 2026")
 */
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get the date for the previous day
 */
function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0]!;
}

/**
 * Get the date for the next day
 */
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0]!;
}

/**
 * Check if a date is today
 */
function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export function DailyNoteScreen({ route, navigation }: Props): React.ReactElement {
  const [currentDate, setCurrentDate] = React.useState(
    route.params?.date ?? new Date().toISOString().split('T')[0]!
  );
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());

  const { dailyNote, isLoading, error, refetch } = useDailyNote(currentDate);

  // Update navigation title with formatted date
  React.useEffect(() => {
    navigation.setOptions({
      title: formatDateForDisplay(currentDate),
    });
  }, [currentDate, navigation]);

  // Navigate to PageScreen when daily note is loaded
  React.useEffect(() => {
    if (dailyNote && !isLoading && !error) {
      // Navigate to PageScreen with the daily note's pageId
      // Replace current screen so back button returns to Home, not this loading screen
      navigation.getParent()?.navigate('PagesTab', {
        screen: 'Page',
        params: { pageId: dailyNote.pageId },
        initial: false,
      });
    }
  }, [dailyNote, isLoading, error, navigation]);

  const handlePreviousDay = () => {
    setCurrentDate(getPreviousDay(currentDate));
  };

  const handleNextDay = () => {
    setCurrentDate(getNextDay(currentDate));
  };

  const handleToday = () => {
    setCurrentDate(new Date().toISOString().split('T')[0]!);
  };

  const handleDateSelect = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0]!;
    setCurrentDate(dateStr);
    setShowDatePicker(false);
  };

  const handleOpenDatePicker = () => {
    // Initialize picker to current date
    const date = new Date(currentDate + 'T00:00:00');
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth());
    setShowDatePicker(true);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={refetch} />
      </View>
    );
  }

  if (!dailyNote) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load daily note</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePreviousDay}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={handleOpenDatePicker}
          accessibilityRole="button"
          accessibilityLabel="Select date"
        >
          <Text style={styles.dateText}>{formatDateForDisplay(currentDate)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNextDay}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Today Button (only show if not already on today) */}
      {!isToday(currentDate) && (
        <TouchableOpacity
          style={styles.todayButton}
          onPress={handleToday}
          accessibilityRole="button"
          accessibilityLabel="Go to today"
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      <ScrollView style={styles.content}>
        <Text style={styles.pageId}>Page ID: {dailyNote.pageId}</Text>
        <Text style={styles.placeholder}>
          Daily note content will be displayed here. This page was{' '}
          {dailyNote.createdAt === dailyNote.updatedAt ? 'just created' : 'previously created'}.
        </Text>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
            >
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Date</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <SimpleDatePicker
            year={selectedYear}
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onDateSelect={handleDateSelect}
          />
        </View>
      </Modal>
    </View>
  );
}

/**
 * Simple date picker component with month/year selection
 */
interface SimpleDatePickerProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onDateSelect: (year: number, month: number, day: number) => void;
}

function SimpleDatePicker({
  year,
  month,
  onYearChange,
  onMonthChange,
  onDateSelect,
}: SimpleDatePickerProps): React.ReactElement {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Generate array of day numbers
  const days: (number | null)[] = [];
  // Add empty slots for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Add actual days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <ScrollView style={styles.pickerContainer}>
      {/* Year/Month Controls */}
      <View style={styles.pickerControls}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onYearChange(year - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
        >
          <Text style={styles.pickerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.pickerYearText}>{year}</Text>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onYearChange(year + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next year"
        >
          <Text style={styles.pickerButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pickerControls}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onMonthChange(month === 0 ? 11 : month - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text style={styles.pickerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.pickerMonthText}>{monthNames[month]}</Text>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onMonthChange(month === 11 ? 0 : month + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text style={styles.pickerButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {/* Day names */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
          <View key={dayName} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{dayName}</Text>
          </View>
        ))}

        {/* Day cells */}
        {days.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day !== null ? (
              <TouchableOpacity
                style={styles.dayButton}
                onPress={() => onDateSelect(year, month, day)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${monthNames[month]} ${day}, ${year}`}
              >
                <Text style={styles.dayButtonText}>{day}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  navButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  dateButton: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  todayButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pageId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
  },
  errorText: {
    fontSize: 15,
    color: '#FF3B30',
    textAlign: 'center',
    paddingVertical: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  modalHeaderSpacer: {
    width: 60,
  },
  pickerContainer: {
    flex: 1,
    padding: 16,
  },
  pickerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  pickerButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  pickerYearText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  pickerMonthText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayNameCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  dayButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  dayButtonText: {
    fontSize: 15,
    color: '#000000',
  },
});
