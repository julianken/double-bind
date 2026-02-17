import type { UseKeyboardPressProps } from './useKeyboardPress.types';
import type { OnKeyPress } from '../../types/BaseKeyboardView';
export declare const useKeyboardPress: <T extends (event?: any) => void, K extends (event?: any) => void>({ onKeyUpPress, onKeyDownPress, onPress, onPressIn, onPressOut, onLongPress, triggerCodes, }: UseKeyboardPressProps<T, K>) => {
    onKeyUpPressHandler: (e: OnKeyPress) => void;
    onKeyDownPressHandler: import("../../types/BaseKeyboardView").OnKeyPressFn | undefined;
    onPressHandler: T | undefined;
};
//# sourceMappingURL=useKeyboardPress.ios.d.ts.map