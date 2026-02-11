import type { OnFocusChangeFn } from '../types';
type UseFocusChange = {
    onFocusChange?: (f: boolean, tag?: number) => void;
    onFocus?: () => void;
    onBlur?: () => void;
};
export declare const useOnFocusChange: ({ onFocusChange, onFocus, onBlur, }: UseFocusChange) => OnFocusChangeFn;
export {};
//# sourceMappingURL=useOnFocusChange.d.ts.map