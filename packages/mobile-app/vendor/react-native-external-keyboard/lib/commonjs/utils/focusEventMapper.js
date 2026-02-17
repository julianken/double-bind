"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.focusEventMapper = void 0;
const focusEventMapper = fn => e => fn === null || fn === void 0 ? void 0 : fn(e.nativeEvent.isFocused);
exports.focusEventMapper = focusEventMapper;
//# sourceMappingURL=focusEventMapper.js.map