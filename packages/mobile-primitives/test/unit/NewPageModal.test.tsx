/**
 * NewPageModal.spec.tsx - Tests for NewPageModal component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { NewPageModal } from '../../src/NewPageModal';

describe('NewPageModal', () => {
  it('should render when visible', () => {
    const { getByText } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={() => {}} />
    );

    expect(getByText('New Page')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <NewPageModal visible={false} onClose={() => {}} onSubmit={() => {}} />
    );

    expect(queryByText('New Page')).toBeNull();
  });

  it('should call onSubmit with title when Create is pressed', () => {
    const onSubmit = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={onSubmit} />
    );

    const input = getByTestId('new-page-input');
    fireEvent.changeText(input, 'My New Page');

    const createButton = getByTestId('create-button');
    fireEvent.press(createButton);

    expect(onSubmit).toHaveBeenCalledWith('My New Page');
  });

  it('should submit "Untitled" when title is empty', () => {
    const onSubmit = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={onSubmit} />
    );

    const createButton = getByTestId('create-button');
    fireEvent.press(createButton);

    expect(onSubmit).toHaveBeenCalledWith('Untitled');
  });

  it('should trim whitespace from title', () => {
    const onSubmit = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={onSubmit} />
    );

    const input = getByTestId('new-page-input');
    fireEvent.changeText(input, '  My Page  ');

    const createButton = getByTestId('create-button');
    fireEvent.press(createButton);

    expect(onSubmit).toHaveBeenCalledWith('My Page');
  });

  it('should call onClose when Cancel is pressed', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={onClose} onSubmit={() => {}} />
    );

    const cancelButton = getByTestId('cancel-button');
    fireEvent.press(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is pressed', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={onClose} onSubmit={() => {}} />
    );

    // The backdrop is the first TouchableOpacity in the modal
    const backdrop = getByTestId('new-page-input').parent?.parent?.parent;
    if (backdrop) {
      fireEvent.press(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should display custom placeholder', () => {
    const { getByPlaceholderText } = render(
      <NewPageModal
        visible={true}
        onClose={() => {}}
        onSubmit={() => {}}
        placeholder="Enter page name"
      />
    );

    expect(getByPlaceholderText('Enter page name')).toBeTruthy();
  });

  it('should show loading state', () => {
    const { getByText } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={() => {}} isLoading={true} />
    );

    expect(getByText('Creating...')).toBeTruthy();
  });

  it('should disable buttons when loading', () => {
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={() => {}} isLoading={true} />
    );

    const createButton = getByTestId('create-button');
    const cancelButton = getByTestId('cancel-button');

    expect(createButton.props.disabled).toBe(true);
    expect(cancelButton.props.disabled).toBe(true);
  });

  it('should reset title after submission', () => {
    const onSubmit = vi.fn();
    const { getByTestId } = render(
      <NewPageModal visible={true} onClose={() => {}} onSubmit={onSubmit} />
    );

    const input = getByTestId('new-page-input');
    fireEvent.changeText(input, 'Test Page');

    const createButton = getByTestId('create-button');
    fireEvent.press(createButton);

    // Title should be reset
    expect(input.props.value).toBe('');
  });
});
