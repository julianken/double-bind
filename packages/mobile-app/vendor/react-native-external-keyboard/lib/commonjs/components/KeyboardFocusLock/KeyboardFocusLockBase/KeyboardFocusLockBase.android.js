"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KeyboardFocusLockBase = void 0;
var _react = _interopRequireDefault(require("react"));
var _ExternalKeyboardLockViewNativeComponent = _interopRequireDefault(require("../../../nativeSpec/ExternalKeyboardLockViewNativeComponent"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const KeyboardFocusLockBase = exports.KeyboardFocusLockBase = /*#__PURE__*/_react.default.memo(({
  lockDisabled = false,
  componentType = 0,
  ...props
}) => {
  return /*#__PURE__*/_react.default.createElement(_ExternalKeyboardLockViewNativeComponent.default, _extends({}, props, {
    componentType: componentType,
    lockDisabled: lockDisabled
  }));
});
//# sourceMappingURL=KeyboardFocusLockBase.android.js.map