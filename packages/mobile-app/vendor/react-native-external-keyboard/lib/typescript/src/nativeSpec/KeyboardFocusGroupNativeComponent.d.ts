import type { ViewProps, ColorValue } from 'react-native';
import type { DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';
export type FocusChange = Readonly<{
    isFocused: boolean;
}>;
export interface KeyboardFocusGroupNativeComponentProps extends ViewProps {
    onGroupFocusChange?: DirectEventHandler<FocusChange>;
    tintColor?: ColorValue;
    groupIdentifier?: string;
    orderGroup?: string;
}
declare const _default: import("react-native/Libraries/Utilities/codegenNativeComponent").NativeComponentType<KeyboardFocusGroupNativeComponentProps>;
export default _default;
//# sourceMappingURL=KeyboardFocusGroupNativeComponent.d.ts.map