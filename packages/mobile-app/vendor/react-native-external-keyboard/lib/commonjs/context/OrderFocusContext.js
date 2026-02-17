"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useOrderFocusGroup = exports.OrderFocusGroupContext = exports.KeyboardOrderFocusGroup = void 0;
var _react = _interopRequireWildcard(require("react"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const OrderFocusGroupContext = exports.OrderFocusGroupContext = /*#__PURE__*/_react.default.createContext(undefined);
const useOrderFocusGroup = () => (0, _react.useContext)(OrderFocusGroupContext);
exports.useOrderFocusGroup = useOrderFocusGroup;
const KeyboardOrderFocusGroup = ({
  children,
  groupId
}) => {
  const id = (0, _react.useId)();
  return /*#__PURE__*/_react.default.createElement(OrderFocusGroupContext.Provider, {
    value: groupId ?? id,
    children: children
  });
};
exports.KeyboardOrderFocusGroup = KeyboardOrderFocusGroup;
//# sourceMappingURL=OrderFocusContext.js.map