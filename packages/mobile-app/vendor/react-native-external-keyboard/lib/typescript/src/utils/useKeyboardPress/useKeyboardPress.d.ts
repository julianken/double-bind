import type { UseKeyboardPressProps } from './useKeyboardPress.types';
export declare const useKeyboardPress: <T extends (event?: any) => void, K extends (event?: any) => void>({ onKeyUpPress, onKeyDownPress, onPress, onPressIn, onPressOut, triggerCodes, }: UseKeyboardPressProps<T, K>) => {
    onKeyUpPressHandler: import("../../types/BaseKeyboardView").OnKeyPressFn | undefined;
    onKeyDownPressHandler: import("../../types/BaseKeyboardView").OnKeyPressFn | undefined;
    onPressHandler: T | undefined;
};
//# sourceMappingURL=useKeyboardPress.d.ts.map