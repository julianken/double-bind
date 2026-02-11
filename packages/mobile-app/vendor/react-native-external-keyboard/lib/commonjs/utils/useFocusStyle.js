"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useFocusStyle = void 0;
var _react = require("react");
var _reactNative = require("react-native");
const backgroundTintMap = _reactNative.Platform.select({
  ios: {
    background: true
  },
  default: {
    background: true,
    default: true
  }
});
const DEFAULT_BACKGROUND_TINT = '#dce3f9';
const useFocusStyle = ({
  focusStyle,
  onFocusChange,
  containerFocusStyle,
  tintColor,
  tintType = 'default',
  style,
  Component,
  withPressedStyle = false
}) => {
  const [focused, setFocusStatus] = (0, _react.useState)(false);
  const onFocusChangeHandler = (0, _react.useCallback)(isFocused => {
    setFocusStatus(isFocused);
    onFocusChange === null || onFocusChange === void 0 || onFocusChange(isFocused);
  }, [onFocusChange]);
  const componentFocusedStyle = (0, _react.useMemo)(() => {
    const specificStyle = typeof focusStyle === 'function' ? focusStyle({
      focused
    }) : focusStyle;
    return focused ? specificStyle : undefined;
  }, [focusStyle, focused]);
  const hoverColor = (0, _react.useMemo)(() => ({
    backgroundColor: tintColor
  }), [tintColor]);
  const containerFocusedStyle = (0, _react.useMemo)(() => {
    if (backgroundTintMap[tintType] && !containerFocusStyle) {
      return focused ? {
        backgroundColor: tintColor ?? DEFAULT_BACKGROUND_TINT
      } : undefined;
    }
    if (!containerFocusStyle) return undefined;
    const specificStyle = typeof containerFocusStyle === 'function' ? containerFocusStyle({
      focused
    }) : containerFocusStyle;
    return focused ? specificStyle : undefined;
  }, [containerFocusStyle, focused, tintColor, tintType]);
  const dafaultComponentStyle = (0, _react.useMemo)(() => [style, componentFocusedStyle], [style, componentFocusedStyle]);
  const styleHandlerPressable = (0, _react.useCallback)(({
    pressed
  }) => {
    if (typeof style === 'function') {
      return [style({
        pressed
      }), componentFocusedStyle];
    } else {
      return [style, componentFocusedStyle];
    }
  }, [componentFocusedStyle, style]);
  const componentStyleViewStyle = Component === _reactNative.Pressable || withPressedStyle ? styleHandlerPressable : dafaultComponentStyle;
  return {
    componentStyleViewStyle,
    componentFocusedStyle,
    containerFocusedStyle,
    onFocusChangeHandler,
    hoverColor,
    focused
  };
};
exports.useFocusStyle = useFocusStyle;
//# sourceMappingURL=useFocusStyle.js.map