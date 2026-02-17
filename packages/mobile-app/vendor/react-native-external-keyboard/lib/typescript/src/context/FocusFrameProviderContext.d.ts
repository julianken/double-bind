import React from 'react';
import { type PropsWithChildren } from 'react';
type FocusFrameContextType = {
    hasFocusLock: boolean;
    setHasFocusLock: (v: boolean) => void;
    focusLockId: symbol | null;
    setFocusLockId: (v: symbol | null) => void;
};
export declare const useFocusFrameContext: () => FocusFrameContextType | undefined;
export declare const FrameProvider: React.FC<PropsWithChildren>;
export {};
//# sourceMappingURL=FocusFrameProviderContext.d.ts.map