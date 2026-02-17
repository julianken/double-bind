import type { GestureResponderEvent } from 'react-native';
import type { UseKeyboardPressProps } from './useKeyboardPress.types';
import type { OnKeyPressFn } from '../../types/BaseKeyboardView';
export declare const ANDROID_SPACE_KEY_CODE = 62;
export declare const ANDROID_DPAD_CENTER_CODE = 23;
export declare const ANDROID_ENTER_CODE = 66;
export declare const ANDROID_TRIGGER_CODES: number[];
export declare const useKeyboardPress: <T extends (event?: any) => void, K extends (event?: any) => void>({ onKeyUpPress, onKeyDownPress, onPressIn, onPressOut, onPress, onLongPress, triggerCodes, }: UseKeyboardPressProps<T, K>) => {
    onKeyUpPressHandler: OnKeyPressFn | undefined;
    onKeyDownPressHandler: OnKeyPressFn | undefined;
    onPressHandler: ((event: GestureResponderEvent) => void) | undefined;
};
//# sourceMappingURL=useKeyboardPress.android.d.ts.map