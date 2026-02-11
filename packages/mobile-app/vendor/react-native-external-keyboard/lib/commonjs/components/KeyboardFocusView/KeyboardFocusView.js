"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KeyboardFocusView = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _BaseKeyboardView = require("../BaseKeyboardView/BaseKeyboardView");
var _RenderPropComponent = require("../RenderPropComponent/RenderPropComponent");
var _useFocusStyle = require("../../utils/useFocusStyle");
var _useKeyboardPress = require("../../utils/useKeyboardPress/useKeyboardPress");
var _IsViewFocusedContext = require("../../context/IsViewFocusedContext");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const KeyboardFocusView = exports.KeyboardFocusView = /*#__PURE__*/_react.default.forwardRef(({
  tintType = 'default',
  autoFocus,
  focusStyle,
  style,
  onFocusChange,
  onPress,
  onLongPress,
  onKeyUpPress,
  onKeyDownPress,
  group = false,
  haloEffect = true,
  canBeFocused = true,
  focusable = true,
  withView = true,
  //ToDo RNCEKV-9 update and rename Discussion #63
  tintColor,
  onFocus,
  onBlur,
  FocusHoverComponent,
  children,
  accessible,
  triggerCodes,
  ...props
}, ref) => {
  const {
    focused,
    containerFocusedStyle,
    onFocusChangeHandler,
    hoverColor
  } = (0, _useFocusStyle.useFocusStyle)({
    onFocusChange,
    tintColor,
    containerFocusStyle: focusStyle,
    tintType
  });
  const withHaloEffect = tintType === 'default' && haloEffect;
  const {
    onKeyUpPressHandler,
    onKeyDownPressHandler
  } = (0, _useKeyboardPress.useKeyboardPress)({
    onKeyUpPress,
    onKeyDownPress,
    onPress,
    onLongPress,
    triggerCodes
  });
  const HoverComonent = (0, _react.useMemo)(() => {
    if (FocusHoverComponent) return FocusHoverComponent;
    if (tintType === 'hover') return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
      style: [hoverColor, styles.absolute, styles.opacity]
    });
    return undefined;
  }, [FocusHoverComponent, hoverColor, tintType]);
  const a11y = (0, _react.useMemo)(() => {
    return _reactNative.Platform.OS === 'android' && withView && accessible !== false || accessible;
  }, [accessible, withView]);
  return /*#__PURE__*/_react.default.createElement(_IsViewFocusedContext.IsViewFocusedContext.Provider, {
    value: focused
  }, /*#__PURE__*/_react.default.createElement(_BaseKeyboardView.BaseKeyboardView, _extends({
    style: [style, containerFocusedStyle],
    ref: ref,
    onKeyUpPress: onKeyUpPressHandler,
    onKeyDownPress: onKeyDownPressHandler,
    onFocus: onFocus,
    onBlur: onBlur,
    onFocusChange: onFocusChangeHandler,
    onContextMenuPress: onLongPress,
    haloEffect: withHaloEffect,
    autoFocus: autoFocus,
    canBeFocused: canBeFocused,
    focusable: focusable,
    tintColor: tintColor,
    group: group,
    accessible: a11y
  }, props), children, focused && HoverComonent && /*#__PURE__*/_react.default.createElement(_RenderPropComponent.RenderPropComponent, {
    render: HoverComonent
  })));
});
const styles = _reactNative.StyleSheet.create({
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  opacity: {
    opacity: 0.3
  }
});
//# sourceMappingURL=KeyboardFocusView.js.map