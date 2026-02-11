"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useTintStyle = void 0;
var _react = require("react");
const useTintStyle = ({
  focusStyle,
  haloEffect,
  onFocusChange,
  tintBackground = '#dce3f9'
}) => {
  const [focused, setFocusStatus] = (0, _react.useState)(false);
  const onFocusChangeHandler = (0, _react.useCallback)(isFocused => {
    setFocusStatus(isFocused);
    onFocusChange === null || onFocusChange === void 0 || onFocusChange(isFocused);
  }, [onFocusChange]);
  const fStyle = (0, _react.useMemo)(() => {
    if (!focusStyle) return undefined;
    const specificStyle = typeof focusStyle === 'function' ? focusStyle({
      focused
    }) : focusStyle;
    return focused ? specificStyle : undefined;
  }, [focused, focusStyle]);
  const tintStyle = (0, _react.useMemo)(() => {
    if (haloEffect) return;
    return focused ? {
      backgroundColor: tintBackground
    } : undefined;
  }, [haloEffect, focused, tintBackground]);
  return {
    onFocusChangeHandler,
    tintStyle,
    fStyle
  };
};
exports.useTintStyle = useTintStyle;
//# sourceMappingURL=useTintStyle.js.map