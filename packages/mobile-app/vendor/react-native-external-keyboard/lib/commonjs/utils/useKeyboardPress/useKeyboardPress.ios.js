"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useKeyboardPress = void 0;
var _react = require("react");
const IOS_SPACE_KEY = 44;
const IOS_RETURN_OR_ENTER = 40;
const IOS_TRIGGER_CODES = [IOS_SPACE_KEY, IOS_RETURN_OR_ENTER];
const useKeyboardPress = ({
  onKeyUpPress,
  onKeyDownPress,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  triggerCodes = IOS_TRIGGER_CODES
}) => {
  const onKeyUpPressHandler = (0, _react.useMemo)(() => {
    return e => {
      onKeyUpPress === null || onKeyUpPress === void 0 || onKeyUpPress(e);
      if (triggerCodes.includes(e.nativeEvent.keyCode)) {
        onPressOut === null || onPressOut === void 0 || onPressOut(e);
        if (e.nativeEvent.isLongPress) {
          onLongPress === null || onLongPress === void 0 || onLongPress({});
        } else {
          onPress === null || onPress === void 0 || onPress({});
        }
      }
    };
  }, [onKeyUpPress, onLongPress, onPress, onPressOut, triggerCodes]);
  const onKeyDownPressHandler = (0, _react.useMemo)(() => {
    if (!onPressIn) return onKeyDownPress;
    return e => {
      onKeyDownPress === null || onKeyDownPress === void 0 || onKeyDownPress(e);
      if (triggerCodes.includes(e.nativeEvent.keyCode)) {
        onPressIn === null || onPressIn === void 0 || onPressIn(e);
      }
    };
  }, [onKeyDownPress, onPressIn, triggerCodes]);
  return {
    onKeyUpPressHandler,
    onKeyDownPressHandler,
    onPressHandler: onPress
  };
};
exports.useKeyboardPress = useKeyboardPress;
//# sourceMappingURL=useKeyboardPress.ios.js.map