"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useFocusFrameContext = exports.FrameProvider = void 0;
var _react = _interopRequireWildcard(require("react"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const FocusFrameProviderContext = /*#__PURE__*/(0, _react.createContext)(undefined);
const useFocusFrameContext = () => (0, _react.useContext)(FocusFrameProviderContext);
exports.useFocusFrameContext = useFocusFrameContext;
const FrameProvider = ({
  children
}) => {
  const [hasFocusLock, setHasFocusLock] = (0, _react.useState)(false);
  const [focusLockId, setFocusLockId] = (0, _react.useState)(null);
  const state = (0, _react.useMemo)(() => ({
    hasFocusLock,
    focusLockId,
    setHasFocusLock,
    setFocusLockId
  }), [hasFocusLock, focusLockId, setHasFocusLock, setFocusLockId]);
  return /*#__PURE__*/_react.default.createElement(FocusFrameProviderContext.Provider, {
    value: state
  }, children);
};
exports.FrameProvider = FrameProvider;
//# sourceMappingURL=FocusFrameProviderContext.js.map