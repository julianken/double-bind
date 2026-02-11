export { ExternalKeyboardViewNative, TextInputFocusWrapperNative, type KeyPress, } from './nativeSpec';
export type { OnKeyPress, KeyboardFocus, BaseKeyboardViewType as KeyboardExtendedViewType, } from './types/BaseKeyboardView';
export type { TintType } from './types/WithKeyboardFocus';
export { BaseKeyboardView, KeyboardFocusView, ExternalKeyboardView, KeyboardExtendedView, KeyboardExtendedBaseView, } from './components';
export { Pressable, Pressable as KeyboardExtendedPressable, } from './components/Touchable/Pressable';
export { KeyboardExtendedInput, KeyboardExtendedInput as TextInput, } from './components/KeyboardExtendedInput/KeyboardExtendedInput';
export { KeyboardFocusGroup } from './components/KeyboardFocusGroup/KeyboardFocusGroup';
export { withKeyboardFocus } from './utils/withKeyboardFocus';
export { useIsViewFocused } from './context/IsViewFocusedContext';
export { KeyboardOrderFocusGroup, OrderFocusGroupContext, useOrderFocusGroup, } from './context/OrderFocusContext';
import * as Keyboard from './modules/Keyboard';
export { Keyboard };
export declare const Focus: {
    Frame: (props: import("react-native").ViewProps) => import("react/jsx-runtime").JSX.Element;
    Trap: (props: import("./types/KeyboardFocusLock.types").KeyboardFocusLockProps) => import("react/jsx-runtime").JSX.Element;
};
//# sourceMappingURL=index.d.ts.map