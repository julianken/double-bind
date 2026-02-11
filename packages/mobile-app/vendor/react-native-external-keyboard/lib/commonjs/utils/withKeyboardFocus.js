"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.withKeyboardFocus = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _components = require("../components");
var _useFocusStyle = require("./useFocusStyle");
var _RenderPropComponent = require("../components/RenderPropComponent/RenderPropComponent");
var _useKeyboardPress = require("./useKeyboardPress/useKeyboardPress");
var _IsViewFocusedContext = require("../context/IsViewFocusedContext");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const withKeyboardFocus = Component => {
  const WithKeyboardFocus = /*#__PURE__*/_react.default.memo(/*#__PURE__*/_react.default.forwardRef(({
    tintType = 'default',
    autoFocus,
    focusStyle,
    style,
    containerStyle,
    onFocusChange,
    onPress,
    onLongPress,
    onKeyUpPress,
    onKeyDownPress,
    onPressIn,
    onPressOut,
    group = false,
    haloEffect = true,
    canBeFocused = true,
    focusable = true,
    tintColor,
    onFocus,
    onBlur,
    containerFocusStyle,
    FocusHoverComponent,
    viewRef,
    componentRef,
    haloCornerRadius,
    haloExpendX,
    haloExpendY,
    groupIdentifier,
    withPressedStyle = false,
    triggerCodes,
    exposeMethods,
    enableA11yFocus,
    screenAutoA11yFocus,
    screenAutoA11yFocusDelay = 300,
    // ToDo align with BaseKeyboardView
    orderIndex,
    orderGroup,
    orderId,
    orderLeft,
    orderRight,
    orderUp,
    orderDown,
    orderForward,
    orderBackward,
    orderFirst,
    orderLast,
    lockFocus,
    ...props
  }, ref) => {
    const {
      focused,
      containerFocusedStyle,
      componentStyleViewStyle,
      onFocusChangeHandler,
      hoverColor
    } = (0, _useFocusStyle.useFocusStyle)({
      onFocusChange,
      tintColor,
      focusStyle,
      containerFocusStyle,
      tintType,
      style,
      withPressedStyle,
      Component
    });
    const withHaloEffect = tintType === 'default' && haloEffect;
    const {
      onKeyUpPressHandler,
      onKeyDownPressHandler,
      onPressHandler
    } = (0, _useKeyboardPress.useKeyboardPress)({
      onKeyUpPress,
      onKeyDownPress,
      onPress: onPress,
      onLongPress: onLongPress,
      onPressIn: onPressIn,
      onPressOut: onPressOut,
      triggerCodes
    });
    const HoverComponent = (0, _react.useMemo)(() => {
      if (FocusHoverComponent) return FocusHoverComponent;
      if (tintType === 'hover') {
        return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
          style: [hoverColor, styles.absolute, styles.opacity]
        });
      }
      return undefined;
    }, [FocusHoverComponent, hoverColor, tintType]);
    const onContextMenuHandler = (0, _react.useCallback)(() => {
      onLongPress === null || onLongPress === void 0 || onLongPress();
    }, [onLongPress]);
    return /*#__PURE__*/_react.default.createElement(_IsViewFocusedContext.IsViewFocusedContext.Provider, {
      value: focused
    }, /*#__PURE__*/_react.default.createElement(_components.BaseKeyboardView, {
      style: [containerStyle, containerFocusedStyle],
      ref: ref,
      viewRef: viewRef,
      onKeyUpPress: onKeyUpPressHandler,
      onKeyDownPress: onKeyDownPressHandler,
      onFocus: onFocus,
      onBlur: onBlur,
      onFocusChange: onFocusChangeHandler,
      onContextMenuPress: onContextMenuHandler,
      haloEffect: withHaloEffect,
      haloCornerRadius: haloCornerRadius,
      haloExpendX: haloExpendX,
      haloExpendY: haloExpendY,
      autoFocus: autoFocus,
      canBeFocused: canBeFocused,
      focusable: focusable,
      tintColor: tintColor,
      group: group,
      groupIdentifier: groupIdentifier,
      exposeMethods: exposeMethods,
      enableA11yFocus: enableA11yFocus,
      screenAutoA11yFocus: screenAutoA11yFocus,
      screenAutoA11yFocusDelay: screenAutoA11yFocusDelay,
      orderIndex: orderIndex,
      orderGroup: orderGroup,
      lockFocus: lockFocus,
      orderId: orderId,
      orderLeft: orderLeft,
      orderRight: orderRight,
      orderUp: orderUp,
      orderDown: orderDown,
      orderForward: orderForward,
      orderBackward: orderBackward,
      orderFirst: orderFirst,
      orderLast: orderLast
    }, /*#__PURE__*/_react.default.createElement(Component, _extends({
      ref: componentRef,
      style: componentStyleViewStyle,
      onPress: onPressHandler,
      onLongPress: onLongPress,
      onPressIn: onPressIn,
      onPressOut: onPressOut
    }, props)), focused && HoverComponent && /*#__PURE__*/_react.default.createElement(_RenderPropComponent.RenderPropComponent, {
      render: HoverComponent
    })));
  }));
  const wrappedComponentName = Component.displayName || Component.name || 'Component';
  WithKeyboardFocus.displayName = `withKeyboardFocus(${wrappedComponentName})`;
  return WithKeyboardFocus;
};
exports.withKeyboardFocus = withKeyboardFocus;
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
//# sourceMappingURL=withKeyboardFocus.js.map