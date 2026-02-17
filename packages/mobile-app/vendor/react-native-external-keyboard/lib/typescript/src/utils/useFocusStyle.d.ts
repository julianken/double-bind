import { type ColorValue, type PressableProps } from 'react-native';
import type { FocusStyle } from '../types';
import type { TintType } from '../types/WithKeyboardFocus';
type UseFocusStyleProps<C> = {
    focusStyle?: FocusStyle;
    containerFocusStyle?: FocusStyle;
    onFocusChange?: (isFocused: boolean) => void;
    tintColor?: ColorValue;
    tintType?: TintType;
    style?: PressableProps['style'];
    Component?: React.ComponentType<C>;
    withPressedStyle?: boolean;
};
export declare const useFocusStyle: <C extends {}>({ focusStyle, onFocusChange, containerFocusStyle, tintColor, tintType, style, Component, withPressedStyle, }: UseFocusStyleProps<C>) => {
    componentStyleViewStyle: (({ pressed }: {
        pressed: boolean;
    }) => import("react-native").StyleProp<import("react-native").ViewStyle>[]) | (import("react-native").StyleProp<import("react-native").ViewStyle> | ((state: import("react-native").PressableStateCallbackType) => import("react-native").StyleProp<import("react-native").ViewStyle>))[];
    componentFocusedStyle: import("react-native").StyleProp<import("react-native").ViewStyle>;
    containerFocusedStyle: import("react-native").StyleProp<import("react-native").ViewStyle>;
    onFocusChangeHandler: (isFocused: boolean) => void;
    hoverColor: {
        backgroundColor: ColorValue | undefined;
    };
    focused: boolean;
};
export {};
//# sourceMappingURL=useFocusStyle.d.ts.map