"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FocusTrap = void 0;
var _react = _interopRequireDefault(require("react"));
var _FocusTrapMountWrapper = require("./FocusTrapMountWrapper");
var _KeyboardFocusLockBase = require("../KeyboardFocusLockBase/KeyboardFocusLockBase");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const FocusTrap = exports.FocusTrap = /*#__PURE__*/_react.default.memo(({
  lockDisabled = false,
  ...props
}) => /*#__PURE__*/_react.default.createElement(_FocusTrapMountWrapper.FocusTrapMountWrapper, null, /*#__PURE__*/_react.default.createElement(_KeyboardFocusLockBase.KeyboardFocusLockBase, _extends({}, props, {
  componentType: 0,
  lockDisabled: lockDisabled
}))));
//# sourceMappingURL=FocusTrap.android.js.map