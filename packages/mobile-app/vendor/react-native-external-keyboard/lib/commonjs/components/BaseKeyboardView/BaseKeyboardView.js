"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BaseKeyboardView = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _nativeSpec = require("../../nativeSpec");
var _ExternalKeyboardViewNativeComponent = require("../../nativeSpec/ExternalKeyboardViewNativeComponent");
var _BaseKeyboardView = require("../../types/BaseKeyboardView");
var _BubbledKeyPressContext = require("../../context/BubbledKeyPressContext");
var _BaseKeyboardView2 = require("./BaseKeyboardView.hooks");
var _GroupIdentifierContext = require("../../context/GroupIdentifierContext");
var _useOnFocusChange = require("../../utils/useOnFocusChange");
var _OrderFocusContext = require("../../context/OrderFocusContext");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const isIOS = _reactNative.Platform.OS === 'ios';
const DEFAULT_EXPOSE_METHODS = ['blur', 'measure', 'measureInWindow', 'measureLayout', 'setNativeProps'];
var BITS = /*#__PURE__*/function (BITS) {
  BITS[BITS["BIT_01"] = 1] = "BIT_01";
  BITS[BITS["BIT_02"] = 2] = "BIT_02";
  BITS[BITS["BIT_03"] = 4] = "BIT_03";
  BITS[BITS["BIT_04"] = 8] = "BIT_04";
  BITS[BITS["BIT_05"] = 16] = "BIT_05";
  BITS[BITS["BIT_06"] = 32] = "BIT_06";
  BITS[BITS["BIT_07"] = 64] = "BIT_07";
  BITS[BITS["BIT_08"] = 128] = "BIT_08";
  BITS[BITS["BIT_09"] = 256] = "BIT_09";
  BITS[BITS["BIT_10"] = 512] = "BIT_10";
  return BITS;
}(BITS || {});
const focusBinaryValue = {
  [_BaseKeyboardView.LockFocusEnum.Up]: BITS.BIT_01,
  [_BaseKeyboardView.LockFocusEnum.Down]: BITS.BIT_02,
  [_BaseKeyboardView.LockFocusEnum.Left]: BITS.BIT_03,
  [_BaseKeyboardView.LockFocusEnum.Right]: BITS.BIT_04,
  [_BaseKeyboardView.LockFocusEnum.Forward]: BITS.BIT_05,
  [_BaseKeyboardView.LockFocusEnum.Backward]: BITS.BIT_06,
  [_BaseKeyboardView.LockFocusEnum.First]: BITS.BIT_09,
  [_BaseKeyboardView.LockFocusEnum.Last]: BITS.BIT_10
};
const mapFocusValues = values => {
  if (!values || !values.length) return 0;

  // eslint-disable-next-line no-bitwise
  return values.reduce((acc, item) => acc | focusBinaryValue[item], 0);
};
const BaseKeyboardView = exports.BaseKeyboardView = /*#__PURE__*/_react.default.memo(/*#__PURE__*/_react.default.forwardRef(({
  onFocusChange,
  onKeyUpPress,
  onKeyDownPress,
  onBubbledContextMenuPress,
  haloEffect,
  autoFocus,
  canBeFocused = true,
  focusable = true,
  group = false,
  onFocus,
  onBlur,
  viewRef,
  groupIdentifier,
  tintColor,
  ignoreGroupFocusHint,
  exposeMethods = DEFAULT_EXPOSE_METHODS,
  enableA11yFocus = false,
  screenAutoA11yFocusDelay = 500,
  lockFocus,
  orderIndex,
  orderForward,
  orderBackward,
  orderFirst,
  orderLast,
  orderGroup,
  ...props
}, ref) => {
  const localRef = (0, _react.useRef)();
  const targetRef = viewRef ?? localRef;
  const lockFocusValue = (0, _react.useMemo)(() => mapFocusValues(lockFocus), [lockFocus]);
  const contextIdentifier = (0, _GroupIdentifierContext.useGroupIdentifierContext)();
  const contextGroupId = (0, _OrderFocusContext.useOrderFocusGroup)();
  const groupId = orderGroup ?? contextGroupId;
  (0, _react.useEffect)(() => {
    if (orderIndex !== undefined && !groupId) console.warn('`orderIndex` must be declared alongside `orderGroup` for proper functionality. Ensure components are wrapped with `KeyboardOrderFocusGroup` or provide `orderGroup` directly.');
  }, [groupId, orderIndex]);
  (0, _react.useImperativeHandle)(ref, () => {
    const actions = {};
    exposeMethods.forEach(method => {
      actions[method] = (...args) => {
        var _componentActions$met;
        const componentActions = targetRef === null || targetRef === void 0 ? void 0 : targetRef.current;
        return componentActions === null || componentActions === void 0 || (_componentActions$met = componentActions[method]) === null || _componentActions$met === void 0 ? void 0 : _componentActions$met.call(componentActions, ...args);
      };
    });
    actions.focus = () => {
      if (targetRef !== null && targetRef !== void 0 && targetRef.current) {
        _ExternalKeyboardViewNativeComponent.Commands.focus(targetRef.current);
      }
    };
    return actions;
  }, [exposeMethods, targetRef]);
  const bubbled = (0, _BaseKeyboardView2.useBubbledInfo)(onBubbledContextMenuPress);
  const onFocusChangeHandler = (0, _useOnFocusChange.useOnFocusChange)({
    onFocusChange,
    onFocus,
    onBlur
  });
  const hasOnFocusChanged = onFocusChange || onFocus || onBlur;
  const ignoreFocusHint = _reactNative.Platform.OS !== 'ios' || !ignoreGroupFocusHint;
  const _orderFirst = orderFirst === null ? undefined : orderFirst ?? orderForward;
  const _orderLast = orderLast === null ? undefined : orderLast ?? orderBackward;
  return /*#__PURE__*/_react.default.createElement(_BubbledKeyPressContext.KeyPressContext.Provider, {
    value: bubbled.context
  }, /*#__PURE__*/_react.default.createElement(_nativeSpec.ExternalKeyboardViewNative, _extends({}, props, {
    haloEffect: haloEffect ?? true,
    ref: targetRef,
    canBeFocused: ignoreFocusHint && focusable && canBeFocused,
    autoFocus: autoFocus,
    onKeyDownPress: onKeyDownPress //ToDo update types
    ,
    onKeyUpPress: onKeyUpPress //ToDo update types
    ,
    onBubbledContextMenuPress: bubbled.contextMenu,
    groupIdentifier: groupIdentifier ?? contextIdentifier,
    tintColor: isIOS ? tintColor : undefined,
    onFocusChange: hasOnFocusChanged && onFocusChangeHandler //ToDo update types
    ,
    hasKeyDownPress: Boolean(onKeyDownPress),
    hasKeyUpPress: Boolean(onKeyUpPress),
    hasOnFocusChanged: Boolean(hasOnFocusChanged),
    group: group,
    orderIndex: orderIndex ?? -1,
    enableA11yFocus: enableA11yFocus,
    screenAutoA11yFocusDelay: screenAutoA11yFocusDelay,
    lockFocus: lockFocusValue,
    orderForward: orderForward,
    orderBackward: orderBackward,
    orderFirst: _orderFirst,
    orderLast: _orderLast,
    orderGroup: groupId
  })));
}));
//# sourceMappingURL=BaseKeyboardView.js.map