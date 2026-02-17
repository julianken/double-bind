"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RenderPropComponent = void 0;
var _react = _interopRequireDefault(require("react"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const RenderPropComponent = ({
  render
}) => {
  if (/*#__PURE__*/_react.default.isValidElement(render)) {
    return render;
  } else if (typeof render === 'function') {
    const Component = render;
    return /*#__PURE__*/_react.default.createElement(Component, null);
  } else {
    return null;
  }
};
exports.RenderPropComponent = RenderPropComponent;
//# sourceMappingURL=RenderPropComponent.js.map