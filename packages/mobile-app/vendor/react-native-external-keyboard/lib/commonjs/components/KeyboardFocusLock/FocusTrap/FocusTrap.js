"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FocusTrap = void 0;
var _reactNative = require("react-native");
var _FocusTrapMountWrapper = require("./FocusTrapMountWrapper");
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const FocusTrap = props => /*#__PURE__*/React.createElement(_FocusTrapMountWrapper.FocusTrapMountWrapper, null, /*#__PURE__*/React.createElement(_reactNative.View, _extends({
  collapsable: false,
  accessibilityViewIsModal: true
}, props)));
exports.FocusTrap = FocusTrap;
//# sourceMappingURL=FocusTrap.js.map