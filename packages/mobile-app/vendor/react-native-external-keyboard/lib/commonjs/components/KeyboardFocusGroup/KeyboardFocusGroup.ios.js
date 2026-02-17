"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KeyboardFocusGroup = void 0;
var _react = _interopRequireDefault(require("react"));
var _nativeSpec = require("../../nativeSpec");
var _GroupIdentifierContext = require("../../context/GroupIdentifierContext");
var _useOnFocusChange = require("../../utils/useOnFocusChange");
var _useFocusStyle = require("../../utils/useFocusStyle");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const KeyboardFocusGroup = exports.KeyboardFocusGroup = /*#__PURE__*/_react.default.memo(props => {
  const {
    groupIdentifier
  } = props;
  const {
    containerFocusedStyle: focusStyle,
    onFocusChangeHandler
  } = (0, _useFocusStyle.useFocusStyle)({
    onFocusChange: props.onFocusChange,
    containerFocusStyle: props.focusStyle
  });
  const onGroupFocusChangeHandler = (0, _useOnFocusChange.useOnFocusChange)({
    ...props,
    onFocusChange: onFocusChangeHandler
  });
  if (!groupIdentifier) return /*#__PURE__*/_react.default.createElement(_nativeSpec.KeyboardFocusGroupNative, _extends({}, props, {
    style: [props.style, focusStyle],
    onGroupFocusChange: onGroupFocusChangeHandler
  }));
  return /*#__PURE__*/_react.default.createElement(_GroupIdentifierContext.GroupIdentifierContext.Provider, {
    value: groupIdentifier
  }, /*#__PURE__*/_react.default.createElement(_nativeSpec.KeyboardFocusGroupNative, _extends({}, props, {
    style: [props.style, focusStyle],
    onGroupFocusChange: onGroupFocusChangeHandler
  })));
});
//# sourceMappingURL=KeyboardFocusGroup.ios.js.map