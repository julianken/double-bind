/**
 * Tests for ServiceProvider component and useServices hook.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ServiceProvider,
  useServices,
  type Services,
} from '../../../src/providers/ServiceProvider';
import type { PageService, BlockService } from '@double-bind/core';

// Mock services for testing
const mockPageService = {} as PageService;
const mockBlockService = {} as BlockService;

const mockServices: Services = {
  pageService: mockPageService,
  blockService: mockBlockService,
};

describe('ServiceProvider', () => {
  it('provides services to child components', () => {
    function TestComponent() {
      const services = useServices();
      return <div>Services: {services ? 'available' : 'unavailable'}</div>;
    }

    render(
      <ServiceProvider services={mockServices}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(screen.getByText('Services: available')).toBeDefined();
  });

  it('provides correct service instances', () => {
    function TestComponent() {
      const { pageService, blockService } = useServices();
      return (
        <div>
          <span data-testid="page-service">
            {pageService === mockPageService ? 'correct' : 'incorrect'}
          </span>
          <span data-testid="block-service">
            {blockService === mockBlockService ? 'correct' : 'incorrect'}
          </span>
        </div>
      );
    }

    render(
      <ServiceProvider services={mockServices}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(screen.getByTestId('page-service').textContent).toBe('correct');
    expect(screen.getByTestId('block-service').textContent).toBe('correct');
  });
});

describe('useServices', () => {
  it('throws error when used outside ServiceProvider', () => {
    function TestComponent() {
      useServices();
      return <div>Should not render</div>;
    }

    // We expect this to throw, so we need to catch it
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useServices must be used within ServiceProvider');
  });

  it('returns Services object when used inside ServiceProvider', () => {
    function TestComponent() {
      const services = useServices();
      return (
        <div>
          <span data-testid="has-page-service">{services.pageService ? 'yes' : 'no'}</span>
          <span data-testid="has-block-service">{services.blockService ? 'yes' : 'no'}</span>
        </div>
      );
    }

    render(
      <ServiceProvider services={mockServices}>
        <TestComponent />
      </ServiceProvider>
    );

    expect(screen.getByTestId('has-page-service').textContent).toBe('yes');
    expect(screen.getByTestId('has-block-service').textContent).toBe('yes');
  });
});
