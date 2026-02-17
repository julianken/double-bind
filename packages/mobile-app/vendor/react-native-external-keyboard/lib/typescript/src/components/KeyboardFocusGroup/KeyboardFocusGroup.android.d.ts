import React, { type PropsWithChildren } from 'react';
import { type ColorValue, type ViewProps } from 'react-native';
import type { FocusStyle } from '../../types';
export type KeyboardFocusGroupProps = PropsWithChildren<{
    groupIdentifier?: string;
    tintColor?: ColorValue;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;
    orderGroup?: string;
    focusStyle?: FocusStyle;
}>;
export declare const KeyboardFocusGroup: React.NamedExoticComponent<ViewProps & {
    groupIdentifier?: string;
    tintColor?: ColorValue;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;
    orderGroup?: string;
    focusStyle?: FocusStyle;
} & {
    children?: React.ReactNode | undefined;
}>;
//# sourceMappingURL=KeyboardFocusGroup.android.d.ts.map