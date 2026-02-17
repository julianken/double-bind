import React from 'react';
import { TextInput, type TextInputProps, type StyleProp, type ViewStyle, type ColorValue } from 'react-native';
import type { FocusStyle } from '../../types/FocusStyle';
import type { TintType } from '../../types/WithKeyboardFocus';
import { type RenderProp } from '../RenderPropComponent/RenderPropComponent';
declare const focusMap: {
    default: number;
    press: number;
    auto: number;
};
declare const blurMap: {
    default: number;
    disable: number;
    auto: number;
};
export type KeyboardFocusViewProps = TextInputProps & {
    focusType?: keyof typeof focusMap;
    blurType?: keyof typeof blurMap;
    containerStyle?: StyleProp<ViewStyle>;
    onFocusChange?: (isFocused: boolean) => void;
    focusStyle?: FocusStyle;
    haloEffect?: boolean;
    canBeFocusable?: boolean;
    focusable?: boolean;
    tintColor?: ColorValue;
    tintType?: TintType;
    containerFocusStyle?: FocusStyle;
    FocusHoverComponent?: RenderProp;
    submitBehavior?: string;
    groupIdentifier?: string;
};
export declare const KeyboardExtendedInput: React.ForwardRefExoticComponent<TextInputProps & {
    focusType?: keyof typeof focusMap;
    blurType?: keyof typeof blurMap;
    containerStyle?: StyleProp<ViewStyle>;
    onFocusChange?: (isFocused: boolean) => void;
    focusStyle?: FocusStyle;
    haloEffect?: boolean;
    canBeFocusable?: boolean;
    focusable?: boolean;
    tintColor?: ColorValue;
    tintType?: TintType;
    containerFocusStyle?: FocusStyle;
    FocusHoverComponent?: RenderProp;
    submitBehavior?: string;
    groupIdentifier?: string;
} & React.RefAttributes<TextInput>>;
export {};
//# sourceMappingURL=KeyboardExtendedInput.d.ts.map