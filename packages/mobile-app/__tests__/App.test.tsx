import { render } from '@testing-library/react-native';
import App from '../src/App';

describe('App', () => {
  it('renders correctly', () => {
    const { getByText } = render(<App />);
    expect(getByText('Double Bind')).toBeTruthy();
  });

  it('displays subtitle', () => {
    const { getByText } = render(<App />);
    expect(getByText('Local-first note-taking')).toBeTruthy();
  });
});
