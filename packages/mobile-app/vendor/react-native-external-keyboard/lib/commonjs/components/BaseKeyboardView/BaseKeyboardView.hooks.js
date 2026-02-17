"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useBubbledInfo = void 0;
var _react = require("react");
var _BubbledKeyPressContext = require("../../context/BubbledKeyPressContext");
const bubbleStub = () => {};
const useBubbledInfo = onBubbledContextMenuPress => {
  const keyPressContext = (0, _BubbledKeyPressContext.useKeyPressContext)();
  const context = (0, _react.useMemo)(() => ({
    bubbledMenu: Boolean(onBubbledContextMenuPress) || keyPressContext.bubbledMenu
  }), [keyPressContext.bubbledMenu, onBubbledContextMenuPress]);
  const contextMenu = context.bubbledMenu ? onBubbledContextMenuPress ?? bubbleStub : undefined;
  return {
    contextMenu,
    context
  };
};
exports.useBubbledInfo = useBubbledInfo;
//# sourceMappingURL=BaseKeyboardView.hooks.js.map