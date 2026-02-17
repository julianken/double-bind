import React from 'react';
import type { BaseKeyboardViewType, KeyboardFocus } from '../../types/BaseKeyboardView';
import type { TintType } from '../../types/WithKeyboardFocus';
import { type RenderProp } from '../RenderPropComponent/RenderPropComponent';
export declare const KeyboardFocusView: React.ForwardRefExoticComponent<import("react-native").ViewProps & import("../../types/BaseKeyboardView").BaseFocusViewProps & {
    exposeMethods?: string[];
    triggerCodes?: number[];
    focusStyle?: import("../../types").FocusStyle;
    onPress?: (e: import("react-native").GestureResponderEvent | import("../..").OnKeyPress) => void;
    onLongPress?: (e?: import("react-native").GestureResponderEvent | import("../..").OnKeyPress) => void;
    onFocus?: () => void;
    onBlur?: () => void;
} & {
    tintType?: TintType;
    FocusHoverComponent?: RenderProp;
    withView?: boolean;
} & React.RefAttributes<KeyboardFocus | BaseKeyboardViewType>>;
//# sourceMappingURL=KeyboardFocusView.d.ts.map