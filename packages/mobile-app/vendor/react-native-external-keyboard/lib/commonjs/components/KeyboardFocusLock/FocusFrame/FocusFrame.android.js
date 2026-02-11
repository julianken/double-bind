"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FocusFrame = void 0;
var _react = _interopRequireDefault(require("react"));
var _FocusFrameProviderContext = require("../../../context/FocusFrameProviderContext");
var _KeyboardFocusLockBase = require("../KeyboardFocusLockBase/KeyboardFocusLockBase");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const FocusFrame = exports.FocusFrame = /*#__PURE__*/_react.default.memo(({
  lockDisabled = false,
  ...props
}) => {
  return /*#__PURE__*/_react.default.createElement(_FocusFrameProviderContext.FrameProvider, null, /*#__PURE__*/_react.default.createElement(_KeyboardFocusLockBase.KeyboardFocusLockBase, _extends({}, props, {
    componentType: 1,
    lockDisabled: lockDisabled
  })));
});
//# sourceMappingURL=FocusFrame.android.js.map