import { type PropsWithChildren } from 'react';
import { type ColorValue, type ViewProps } from 'react-native';
import type { FocusStyle } from '../../types';
export type KeyboardFocusGroupProps = PropsWithChildren<ViewProps & {
    groupIdentifier?: string;
    tintColor?: ColorValue;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;
    focusStyle?: FocusStyle;
    orderGroup?: string;
}>;
export declare const KeyboardFocusGroup: React.FC<KeyboardFocusGroupProps>;
//# sourceMappingURL=KeyboardFocusGroup.d.ts.map