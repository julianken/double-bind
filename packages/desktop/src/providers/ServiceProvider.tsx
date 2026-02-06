/**
 * ServiceProvider - Makes core services available to all components via React Context.
 *
 * Services are created once at application startup and provided to the component tree.
 * All components can access services via the useServices() hook.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { PageService, BlockService, GraphService, SavedQueryService } from '@double-bind/core';

/**
 * Services container - holds all service instances.
 */
export interface Services {
  pageService: PageService;
  blockService: BlockService;
  graphService: GraphService;
  savedQueryService: SavedQueryService;
}

/**
 * Service context - null when used outside provider.
 * Exported for components that need to check context availability without throwing.
 */
export const ServiceContext = createContext<Services | null>(null);

/**
 * Props for ServiceProvider component.
 */
export interface ServiceProviderProps {
  services: Services;
  children: ReactNode;
}

/**
 * ServiceProvider component - provides services to the component tree.
 *
 * @example
 * ```tsx
 * const services = {
 *   pageService: new PageService(pageRepo, blockRepo, linkRepo),
 *   blockService: new BlockService(blockRepo, linkRepo, tagRepo, propertyRepo)
 * };
 *
 * <ServiceProvider services={services}>
 *   <App />
 * </ServiceProvider>
 * ```
 */
export function ServiceProvider({ services, children }: ServiceProviderProps) {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

/**
 * Hook to access services from the context.
 *
 * @throws Error if used outside of ServiceProvider
 * @returns Services object containing all service instances
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { pageService, blockService } = useServices();
 *   // Use services...
 * }
 * ```
 */
export function useServices(): Services {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return context;
}

/**
 * Hook to check if services are available without throwing.
 * Useful for components that can render in both unit test and full app contexts.
 *
 * @returns Services object if available, null otherwise
 */
export function useServicesOptional(): Services | null {
  return useContext(ServiceContext);
}
