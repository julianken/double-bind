"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FocusTrapMountWrapper = void 0;
var _react = require("react");
var _FocusFrameProviderContext = require("../../../context/FocusFrameProviderContext");
const FocusTrapMountWrapper = ({
  children
}) => {
  const a11yFrameContext = (0, _FocusFrameProviderContext.useFocusFrameContext)();
  const instanceId = (0, _react.useRef)(Symbol('FocusLock'));
  if (!a11yFrameContext) {
    console.warn('Focus.Trap must be used within a Focus.Frame');
    return children;
  }
  const {
    hasFocusLock,
    setHasFocusLock,
    focusLockId,
    setFocusLockId
  } = a11yFrameContext;
  const isActive = !hasFocusLock || focusLockId === instanceId.current;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  (0, _react.useEffect)(() => {
    const id = instanceId.current;
    if (!hasFocusLock) {
      setHasFocusLock(true);
      setFocusLockId(id);
    }
    return () => {
      if (focusLockId === id) {
        setHasFocusLock(false);
        setFocusLockId(null);
      }
    };
  }, [hasFocusLock, setHasFocusLock, focusLockId, setFocusLockId]);
  if (!isActive) {
    console.warn('Multiple Focus.Trap components may cause unstable behavior');
  }
  return children;
};
exports.FocusTrapMountWrapper = FocusTrapMountWrapper;
//# sourceMappingURL=FocusTrapMountWrapper.js.map