"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useFocusStyle = void 0;
var _react = require("react");
var _reactNative = require("react-native");
const useFocusStyle = (focusStyle, onFocusChange) => {
  const [focused, setFocusStatus] = (0, _react.useState)(false);
  const onFocusChangeHandler = (0, _react.useCallback)(isFocused => {
    setFocusStatus(isFocused);
    onFocusChange === null || onFocusChange === void 0 || onFocusChange(isFocused);
  }, [onFocusChange]);
  const fStyle = (0, _react.useMemo)(() => {
    if (!focusStyle) return focused ? styles.defaultHighlight : undefined;
    const specificStyle = typeof focusStyle === 'function' ? focusStyle({
      focused
    }) : focusStyle;
    return focused ? specificStyle : undefined;
  }, [focused, focusStyle]);
  return {
    onFocusChangeHandler,
    fStyle
  };
};
exports.useFocusStyle = useFocusStyle;
const styles = _reactNative.StyleSheet.create({
  defaultHighlight: {
    backgroundColor: '#dce3f9'
  }
});
//# sourceMappingURL=useFocusStyle.js.map