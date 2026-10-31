/**
 * NEXORA Data Adapters Layer
 * Central entry point for all P1.4.2 backend-to-frontend and frontend-to-backend adapters.
 * Decouples React UI components from REST API transport payloads.
 */

export * from './communityAdapter';
export * from './libraryAdapter';
export * from './contentAdapter';
export * from './eventsAdapter';
export * from './supportAdapter';
export * from '../../types/contracts';
