"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useOnFocusChange = void 0;
var _react = require("react");
const useOnFocusChange = ({
  onFocusChange,
  onFocus,
  onBlur
}) => (0, _react.useCallback)(e => {
  var _e$nativeEvent;
  onFocusChange === null || onFocusChange === void 0 || onFocusChange(e.nativeEvent.isFocused, e === null || e === void 0 || (_e$nativeEvent = e.nativeEvent) === null || _e$nativeEvent === void 0 ? void 0 : _e$nativeEvent.target);
  if (e.nativeEvent.isFocused) {
    onFocus === null || onFocus === void 0 || onFocus();
  } else {
    onBlur === null || onBlur === void 0 || onBlur();
  }
}, [onBlur, onFocus, onFocusChange]);
exports.useOnFocusChange = useOnFocusChange;
//# sourceMappingURL=useOnFocusChange.js.map