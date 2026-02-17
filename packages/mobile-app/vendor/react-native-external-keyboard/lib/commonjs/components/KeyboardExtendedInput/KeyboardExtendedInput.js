"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KeyboardExtendedInput = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _nativeSpec = require("../../nativeSpec");
var _useFocusStyle = require("../../utils/useFocusStyle");
var _focusEventMapper = require("../../utils/focusEventMapper");
var _RenderPropComponent = require("../RenderPropComponent/RenderPropComponent");
var _GroupIdentifierContext = require("../../context/GroupIdentifierContext");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const isIOS = _reactNative.Platform.OS === 'ios';
const focusMap = {
  default: 0,
  press: 1,
  auto: 2
};
const blurMap = {
  default: 0,
  disable: 1,
  auto: 2
};
const KeyboardExtendedInput = exports.KeyboardExtendedInput = /*#__PURE__*/_react.default.forwardRef(({
  focusType = 'default',
  blurType = 'default',
  containerStyle,
  onFocusChange,
  focusStyle,
  style,
  haloEffect = true,
  canBeFocusable = true,
  focusable = true,
  containerFocusStyle,
  tintColor,
  tintType = 'default',
  FocusHoverComponent,
  onSubmitEditing,
  submitBehavior,
  groupIdentifier,
  ...props
}, ref) => {
  const {
    focused,
    containerFocusedStyle,
    componentFocusedStyle,
    onFocusChangeHandler,
    hoverColor
  } = (0, _useFocusStyle.useFocusStyle)({
    onFocusChange,
    tintColor,
    focusStyle,
    containerFocusStyle,
    tintType
  });
  const contextIdentifier = (0, _GroupIdentifierContext.useGroupIdentifierContext)();
  const withHaloEffect = tintType === 'default' && haloEffect;
  const nativeFocusHandler = (0, _react.useMemo)(() => (0, _focusEventMapper.focusEventMapper)(onFocusChangeHandler), [onFocusChangeHandler]);
  const HoverComonent = (0, _react.useMemo)(() => {
    if (FocusHoverComponent) return FocusHoverComponent;
    if (tintType === 'hover') return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
      style: [hoverColor, styles.absolute, styles.opacity]
    });
    return undefined;
  }, [FocusHoverComponent, hoverColor, tintType]);
  const blurOnSubmit = submitBehavior ? submitBehavior === 'blurAndSubmit' : props.blurOnSubmit ?? true;
  return /*#__PURE__*/_react.default.createElement(_nativeSpec.TextInputFocusWrapperNative, {
    onFocusChange: nativeFocusHandler //ToDo update type
    ,
    focusType: focusMap[focusType],
    blurType: blurMap[blurType],
    style: [containerStyle, containerFocusedStyle],
    haloEffect: withHaloEffect,
    multiline: props.multiline,
    blurOnSubmit: blurOnSubmit,
    onMultiplyTextSubmit: onSubmitEditing,
    canBeFocused: canBeFocusable && focusable,
    tintColor: isIOS ? tintColor : undefined,
    groupIdentifier: groupIdentifier ?? contextIdentifier
  }, /*#__PURE__*/_react.default.createElement(_reactNative.TextInput, _extends({
    ref: ref,
    editable: canBeFocusable && focusable,
    style: [style, componentFocusedStyle],
    onSubmitEditing: onSubmitEditing,
    submitBehavior: submitBehavior
  }, props)), focused && HoverComonent && /*#__PURE__*/_react.default.createElement(_RenderPropComponent.RenderPropComponent, {
    render: HoverComonent
  }));
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
//# sourceMappingURL=KeyboardExtendedInput.js.map