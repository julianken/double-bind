"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "BaseKeyboardView", {
  enumerable: true,
  get: function () {
    return _components.BaseKeyboardView;
  }
});
Object.defineProperty(exports, "ExternalKeyboardView", {
  enumerable: true,
  get: function () {
    return _components.ExternalKeyboardView;
  }
});
Object.defineProperty(exports, "ExternalKeyboardViewNative", {
  enumerable: true,
  get: function () {
    return _nativeSpec.ExternalKeyboardViewNative;
  }
});
exports.Keyboard = exports.Focus = void 0;
Object.defineProperty(exports, "KeyboardExtendedBaseView", {
  enumerable: true,
  get: function () {
    return _components.KeyboardExtendedBaseView;
  }
});
Object.defineProperty(exports, "KeyboardExtendedInput", {
  enumerable: true,
  get: function () {
    return _KeyboardExtendedInput.KeyboardExtendedInput;
  }
});
Object.defineProperty(exports, "KeyboardExtendedPressable", {
  enumerable: true,
  get: function () {
    return _Pressable.Pressable;
  }
});
Object.defineProperty(exports, "KeyboardExtendedView", {
  enumerable: true,
  get: function () {
    return _components.KeyboardExtendedView;
  }
});
Object.defineProperty(exports, "KeyboardFocusGroup", {
  enumerable: true,
  get: function () {
    return _KeyboardFocusGroup.KeyboardFocusGroup;
  }
});
Object.defineProperty(exports, "KeyboardFocusView", {
  enumerable: true,
  get: function () {
    return _components.KeyboardFocusView;
  }
});
Object.defineProperty(exports, "KeyboardOrderFocusGroup", {
  enumerable: true,
  get: function () {
    return _OrderFocusContext.KeyboardOrderFocusGroup;
  }
});
Object.defineProperty(exports, "OrderFocusGroupContext", {
  enumerable: true,
  get: function () {
    return _OrderFocusContext.OrderFocusGroupContext;
  }
});
Object.defineProperty(exports, "Pressable", {
  enumerable: true,
  get: function () {
    return _Pressable.Pressable;
  }
});
Object.defineProperty(exports, "TextInput", {
  enumerable: true,
  get: function () {
    return _KeyboardExtendedInput.KeyboardExtendedInput;
  }
});
Object.defineProperty(exports, "TextInputFocusWrapperNative", {
  enumerable: true,
  get: function () {
    return _nativeSpec.TextInputFocusWrapperNative;
  }
});
Object.defineProperty(exports, "useIsViewFocused", {
  enumerable: true,
  get: function () {
    return _IsViewFocusedContext.useIsViewFocused;
  }
});
Object.defineProperty(exports, "useOrderFocusGroup", {
  enumerable: true,
  get: function () {
    return _OrderFocusContext.useOrderFocusGroup;
  }
});
Object.defineProperty(exports, "withKeyboardFocus", {
  enumerable: true,
  get: function () {
    return _withKeyboardFocus.withKeyboardFocus;
  }
});
var _FocusFrame = require("./components/KeyboardFocusLock/FocusFrame/FocusFrame");
var _FocusTrap = require("./components/KeyboardFocusLock/FocusTrap/FocusTrap");
var _nativeSpec = require("./nativeSpec");
var _components = require("./components");
var _Pressable = require("./components/Touchable/Pressable");
var _KeyboardExtendedInput = require("./components/KeyboardExtendedInput/KeyboardExtendedInput");
var _KeyboardFocusGroup = require("./components/KeyboardFocusGroup/KeyboardFocusGroup");
var _withKeyboardFocus = require("./utils/withKeyboardFocus");
var _IsViewFocusedContext = require("./context/IsViewFocusedContext");
var _OrderFocusContext = require("./context/OrderFocusContext");
var Keyboard = _interopRequireWildcard(require("./modules/Keyboard"));
exports.Keyboard = Keyboard;
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const Focus = exports.Focus = {
  Frame: _FocusFrame.FocusFrame,
  Trap: _FocusTrap.FocusTrap
};
//# sourceMappingURL=index.js.map