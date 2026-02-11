import React, { type RefObject } from 'react';
import { View, type StyleProp, type ViewStyle, type PressableProps } from 'react-native';
import type { FocusStyle } from '../types';
import type { KeyboardFocus, OnKeyPress } from '../types/BaseKeyboardView';
import type { TintType } from '../types/WithKeyboardFocus';
import { type RenderProp } from '../components/RenderPropComponent/RenderPropComponent';
import type { FocusViewProps } from '../types/KeyboardFocusView.types';
export type KeyboardPressType<K, T> = {
    onPress?: T | ((e?: OnKeyPress) => void);
    onLongPress?: T | ((e?: OnKeyPress) => void);
    onPressIn?: K | ((e?: OnKeyPress) => void);
    onPressOut?: K | ((e?: OnKeyPress) => void);
};
export type WithKeyboardProps<R> = {
    withPressedStyle?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    containerFocusStyle?: FocusStyle;
    tintType?: TintType;
    componentRef?: RefObject<R>;
    FocusHoverComponent?: RenderProp;
    style?: PressableProps['style'];
};
export type WithKeyboardFocus<K, T, C, R> = C & KeyboardPressType<K, T> & FocusViewProps & WithKeyboardProps<R>;
export declare const withKeyboardFocus: <K, T, C extends {}, R>(Component: React.ComponentType<C>) => React.MemoExoticComponent<React.ForwardRefExoticComponent<React.PropsWithoutRef<WithKeyboardFocus<K, T, C, R>> & React.RefAttributes<View | KeyboardFocus>>>;
//# sourceMappingURL=withKeyboardFocus.d.ts.map