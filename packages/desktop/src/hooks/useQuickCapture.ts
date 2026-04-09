/**
 * useQuickCapture - Handles QuickCapture submit logic.
 *
 * Stub implementation: logs captured text to console.
 * Real implementation will connect to PageService when available.
 */

import { useState, useCallback, useRef, useContext } from 'react';
import { ServiceContext } from '../providers/ServiceProvider.js';

export interface UseQuickCaptureResult {
  handleSubmit: (text: string) => void;
  isSubmitting: boolean;
}

export function useQuickCapture(): UseQuickCaptureResult {
  const services = useContext(ServiceContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isSubmittingRef.current || !services) return;

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const { pageService, blockService } = services;

      pageService
        .getTodaysDailyNote()
        .then((page) => blockService.createBlock(page.pageId, null, text.trim()))
        .finally(() => {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        });
    },
    [services]
  );

  return { handleSubmit, isSubmitting };
}
