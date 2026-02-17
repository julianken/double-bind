import React, { type PropsWithChildren } from 'react';
import { type ColorValue, type ViewProps } from 'react-native';
import type { FocusStyle } from '../../types';
export type KeyboardFocusGroupProps = PropsWithChildren<{
    groupIdentifier?: string;
    tintColor?: ColorValue;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;
    focusStyle?: FocusStyle;
    orderGroup?: string;
}>;
export declare const KeyboardFocusGroup: React.NamedExoticComponent<ViewProps & {
    groupIdentifier?: string;
    tintColor?: ColorValue;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;
    focusStyle?: FocusStyle;
    orderGroup?: string;
} & {
    children?: React.ReactNode | undefined;
}>;
//# sourceMappingURL=KeyboardFocusGroup.ios.d.ts.map