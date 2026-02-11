import type { FocusStyle } from '../../../../types';
export declare const useTintStyle: ({ focusStyle, haloEffect, onFocusChange, tintBackground, }: {
    haloEffect?: boolean;
    focusStyle?: FocusStyle;
    tintBackground?: string;
    onFocusChange?: (isFocused: boolean) => void;
}) => {
    onFocusChangeHandler: (isFocused: boolean) => void;
    tintStyle: {
        backgroundColor: string;
    } | undefined;
    fStyle: import("react-native").StyleProp<import("react-native").ViewStyle>;
};
//# sourceMappingURL=useTintStyle.d.ts.map