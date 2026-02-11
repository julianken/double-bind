"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useKeyboardPress = exports.ANDROID_TRIGGER_CODES = exports.ANDROID_SPACE_KEY_CODE = exports.ANDROID_ENTER_CODE = exports.ANDROID_DPAD_CENTER_CODE = void 0;
var _react = require("react");
const ANDROID_SPACE_KEY_CODE = exports.ANDROID_SPACE_KEY_CODE = 62;
const ANDROID_DPAD_CENTER_CODE = exports.ANDROID_DPAD_CENTER_CODE = 23;
const ANDROID_ENTER_CODE = exports.ANDROID_ENTER_CODE = 66;
const ANDROID_TRIGGER_CODES = exports.ANDROID_TRIGGER_CODES = [ANDROID_SPACE_KEY_CODE, ANDROID_DPAD_CENTER_CODE, ANDROID_ENTER_CODE];
const useDebouncedCallback = (callback, delay) => {
  const timeoutRef = (0, _react.useRef)();
  return (0, _react.useCallback)((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};
const useKeyboardPress = ({
  onKeyUpPress,
  onKeyDownPress,
  onPressIn,
  onPressOut,
  onPress,
  onLongPress,
  triggerCodes = ANDROID_TRIGGER_CODES
}) => {
  const isLongPressRef = (0, _react.useRef)(false);
  const debouncedOnPress = useDebouncedCallback(event => {
    if (isLongPressRef.current) {
      onLongPress === null || onLongPress === void 0 || onLongPress();
    } else {
      onPress === null || onPress === void 0 || onPress(event);
    }
    isLongPressRef.current = false;
  }, 40);
  const onKeyUpPressHandler = (0, _react.useCallback)(e => {
    const {
      nativeEvent: {
        keyCode,
        isLongPress
      }
    } = e;
    onPressOut === null || onPressOut === void 0 || onPressOut(e);
    onKeyUpPress === null || onKeyUpPress === void 0 || onKeyUpPress(e);
    if (triggerCodes.includes(keyCode)) {
      if (isLongPress) {
        isLongPressRef.current = true;
        debouncedOnPress();
      }
    }
  }, [onPressOut, onKeyUpPress, triggerCodes, debouncedOnPress]);
  const onKeyDownPressHandler = (0, _react.useMemo)(() => {
    if (!onPressIn) return onKeyDownPress;
    return e => {
      onKeyDownPress === null || onKeyDownPress === void 0 || onKeyDownPress(e);
      if (triggerCodes.includes(e.nativeEvent.keyCode)) {
        onPressIn === null || onPressIn === void 0 || onPressIn(e);
      }
    };
  }, [onKeyDownPress, onPressIn, triggerCodes]);
  const onPressHandler = (0, _react.useCallback)(event => {
    debouncedOnPress(event);
  }, [debouncedOnPress]);
  const hasHandler = onPressOut || onKeyUpPress || onLongPress || onPress;
  return {
    onKeyUpPressHandler: hasHandler ? onKeyUpPressHandler : undefined,
    onKeyDownPressHandler,
    onPressHandler: onPress ? onPressHandler : undefined
  };
};
exports.useKeyboardPress = useKeyboardPress;
//# sourceMappingURL=useKeyboardPress.android.js.map