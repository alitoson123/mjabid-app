(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/@capacitor/core/dist/index.js
  var createCapacitorPlatforms, initPlatforms, CapacitorPlatforms, addPlatform, setPlatform, ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, Plugins, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp;
  var init_dist = __esm({
    "node_modules/@capacitor/core/dist/index.js"() {
      createCapacitorPlatforms = (win) => {
        const defaultPlatformMap = /* @__PURE__ */ new Map();
        defaultPlatformMap.set("web", { name: "web" });
        const capPlatforms = win.CapacitorPlatforms || {
          currentPlatform: { name: "web" },
          platforms: defaultPlatformMap
        };
        const addPlatform2 = (name, platform2) => {
          capPlatforms.platforms.set(name, platform2);
        };
        const setPlatform2 = (name) => {
          if (capPlatforms.platforms.has(name)) {
            capPlatforms.currentPlatform = capPlatforms.platforms.get(name);
          }
        };
        capPlatforms.addPlatform = addPlatform2;
        capPlatforms.setPlatform = setPlatform2;
        return capPlatforms;
      };
      initPlatforms = (win) => win.CapacitorPlatforms = createCapacitorPlatforms(win);
      CapacitorPlatforms = /* @__PURE__ */ initPlatforms(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      addPlatform = CapacitorPlatforms.addPlatform;
      setPlatform = CapacitorPlatforms.setPlatform;
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        var _a, _b, _c, _d, _e;
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins2 = cap.Plugins = cap.Plugins || {};
        const capPlatforms = win.CapacitorPlatforms;
        const defaultGetPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const getPlatform = ((_a = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _a === void 0 ? void 0 : _a.getPlatform) || defaultGetPlatform;
        const defaultIsNativePlatform = () => getPlatform() !== "web";
        const isNativePlatform = ((_b = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _b === void 0 ? void 0 : _b.isNativePlatform) || defaultIsNativePlatform;
        const defaultIsPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const isPluginAvailable = ((_c = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _c === void 0 ? void 0 : _c.isPluginAvailable) || defaultIsPluginAvailable;
        const defaultGetPluginHeader = (pluginName) => {
          var _a2;
          return (_a2 = cap.PluginHeaders) === null || _a2 === void 0 ? void 0 : _a2.find((h) => h.name === pluginName);
        };
        const getPluginHeader = ((_d = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _d === void 0 ? void 0 : _d.getPluginHeader) || defaultGetPluginHeader;
        const handleError = (err) => win.console.error(err);
        const pluginMethodNoop = (_target, prop, pluginName) => {
          return Promise.reject(`${pluginName} does not have an implementation of "${prop}".`);
        };
        const registeredPlugins = /* @__PURE__ */ new Map();
        const defaultRegisterPlugin = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform2 = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform2 in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform2] === "function" ? jsImplementation = await jsImplementations[platform2]() : jsImplementation = jsImplementations[platform2];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a2, _b2;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a2 = impl[prop]) === null || _a2 === void 0 ? void 0 : _a2.bind(impl);
              }
            } else if (impl) {
              return (_b2 = impl[prop]) === null || _b2 === void 0 ? void 0 : _b2.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform2}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform2}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve) => call.then(() => resolve({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins2[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([
              ...Object.keys(jsImplementations),
              ...pluginHeader ? [platform2] : []
            ])
          });
          return proxy;
        };
        const registerPlugin2 = ((_e = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _e === void 0 ? void 0 : _e.registerPlugin) || defaultRegisterPlugin;
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.pluginMethodNoop = pluginMethodNoop;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        cap.platform = cap.getPlatform();
        cap.isNative = cap.isNativePlatform();
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      Plugins = Capacitor.Plugins;
      WebPlugin = class {
        constructor(config) {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
          if (config) {
            console.warn(`Capacitor WebPlugin "${config.name}" config object was deprecated in v3 and will be removed in v4.`);
            this.config = config;
          }
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          return !!this.listeners[eventName].length;
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          this.listeners[eventName].splice(index, 1);
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = `; expires=${(options.expires || "").replace("expires=", "")}`;
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/errors.js
  var __extends, PURCHASES_ERROR_CODE, UninitializedPurchasesError, UnsupportedPlatformError;
  var init_errors = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/errors.js"() {
      __extends = /* @__PURE__ */ (function() {
        var extendStatics = function(d, b) {
          extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
            d2.__proto__ = b2;
          } || function(d2, b2) {
            for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
          };
          return extendStatics(d, b);
        };
        return function(d, b) {
          if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
          extendStatics(d, b);
          function __() {
            this.constructor = d;
          }
          d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
      })();
      (function(PURCHASES_ERROR_CODE2) {
        PURCHASES_ERROR_CODE2["UNKNOWN_ERROR"] = "0";
        PURCHASES_ERROR_CODE2["PURCHASE_CANCELLED_ERROR"] = "1";
        PURCHASES_ERROR_CODE2["STORE_PROBLEM_ERROR"] = "2";
        PURCHASES_ERROR_CODE2["PURCHASE_NOT_ALLOWED_ERROR"] = "3";
        PURCHASES_ERROR_CODE2["PURCHASE_INVALID_ERROR"] = "4";
        PURCHASES_ERROR_CODE2["PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR"] = "5";
        PURCHASES_ERROR_CODE2["PRODUCT_ALREADY_PURCHASED_ERROR"] = "6";
        PURCHASES_ERROR_CODE2["RECEIPT_ALREADY_IN_USE_ERROR"] = "7";
        PURCHASES_ERROR_CODE2["INVALID_RECEIPT_ERROR"] = "8";
        PURCHASES_ERROR_CODE2["MISSING_RECEIPT_FILE_ERROR"] = "9";
        PURCHASES_ERROR_CODE2["NETWORK_ERROR"] = "10";
        PURCHASES_ERROR_CODE2["INVALID_CREDENTIALS_ERROR"] = "11";
        PURCHASES_ERROR_CODE2["UNEXPECTED_BACKEND_RESPONSE_ERROR"] = "12";
        PURCHASES_ERROR_CODE2["RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR"] = "13";
        PURCHASES_ERROR_CODE2["INVALID_APP_USER_ID_ERROR"] = "14";
        PURCHASES_ERROR_CODE2["OPERATION_ALREADY_IN_PROGRESS_ERROR"] = "15";
        PURCHASES_ERROR_CODE2["UNKNOWN_BACKEND_ERROR"] = "16";
        PURCHASES_ERROR_CODE2["INVALID_APPLE_SUBSCRIPTION_KEY_ERROR"] = "17";
        PURCHASES_ERROR_CODE2["INELIGIBLE_ERROR"] = "18";
        PURCHASES_ERROR_CODE2["INSUFFICIENT_PERMISSIONS_ERROR"] = "19";
        PURCHASES_ERROR_CODE2["PAYMENT_PENDING_ERROR"] = "20";
        PURCHASES_ERROR_CODE2["INVALID_SUBSCRIBER_ATTRIBUTES_ERROR"] = "21";
        PURCHASES_ERROR_CODE2["LOG_OUT_ANONYMOUS_USER_ERROR"] = "22";
        PURCHASES_ERROR_CODE2["CONFIGURATION_ERROR"] = "23";
        PURCHASES_ERROR_CODE2["UNSUPPORTED_ERROR"] = "24";
        PURCHASES_ERROR_CODE2["EMPTY_SUBSCRIBER_ATTRIBUTES_ERROR"] = "25";
        PURCHASES_ERROR_CODE2["PRODUCT_DISCOUNT_MISSING_IDENTIFIER_ERROR"] = "26";
        PURCHASES_ERROR_CODE2["PRODUCT_DISCOUNT_MISSING_SUBSCRIPTION_GROUP_IDENTIFIER_ERROR"] = "28";
        PURCHASES_ERROR_CODE2["CUSTOMER_INFO_ERROR"] = "29";
        PURCHASES_ERROR_CODE2["SYSTEM_INFO_ERROR"] = "30";
        PURCHASES_ERROR_CODE2["BEGIN_REFUND_REQUEST_ERROR"] = "31";
        PURCHASES_ERROR_CODE2["PRODUCT_REQUEST_TIMED_OUT_ERROR"] = "32";
        PURCHASES_ERROR_CODE2["API_ENDPOINT_BLOCKED"] = "33";
        PURCHASES_ERROR_CODE2["INVALID_PROMOTIONAL_OFFER_ERROR"] = "34";
        PURCHASES_ERROR_CODE2["OFFLINE_CONNECTION_ERROR"] = "35";
      })(PURCHASES_ERROR_CODE || (PURCHASES_ERROR_CODE = {}));
      UninitializedPurchasesError = /** @class */
      (function(_super) {
        __extends(UninitializedPurchasesError2, _super);
        function UninitializedPurchasesError2() {
          var _this = _super.call(this, "There is no singleton instance. Make sure you configure Purchases before trying to get the default instance. More info here: https://errors.rev.cat/configuring-sdk") || this;
          Object.setPrototypeOf(_this, UninitializedPurchasesError2.prototype);
          return _this;
        }
        return UninitializedPurchasesError2;
      })(Error);
      UnsupportedPlatformError = /** @class */
      (function(_super) {
        __extends(UnsupportedPlatformError2, _super);
        function UnsupportedPlatformError2() {
          var _this = _super.call(this, "This method is not available in the current platform.") || this;
          Object.setPrototypeOf(_this, UnsupportedPlatformError2.prototype);
          return _this;
        }
        return UnsupportedPlatformError2;
      })(Error);
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/customerInfo.js
  var init_customerInfo = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/customerInfo.js"() {
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/offerings.js
  var PACKAGE_TYPE, INTRO_ELIGIBILITY_STATUS, PRODUCT_CATEGORY, PRODUCT_TYPE, PRORATION_MODE, RECURRENCE_MODE, OFFER_PAYMENT_MODE, PERIOD_UNIT;
  var init_offerings = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/offerings.js"() {
      (function(PACKAGE_TYPE2) {
        PACKAGE_TYPE2["UNKNOWN"] = "UNKNOWN";
        PACKAGE_TYPE2["CUSTOM"] = "CUSTOM";
        PACKAGE_TYPE2["LIFETIME"] = "LIFETIME";
        PACKAGE_TYPE2["ANNUAL"] = "ANNUAL";
        PACKAGE_TYPE2["SIX_MONTH"] = "SIX_MONTH";
        PACKAGE_TYPE2["THREE_MONTH"] = "THREE_MONTH";
        PACKAGE_TYPE2["TWO_MONTH"] = "TWO_MONTH";
        PACKAGE_TYPE2["MONTHLY"] = "MONTHLY";
        PACKAGE_TYPE2["WEEKLY"] = "WEEKLY";
      })(PACKAGE_TYPE || (PACKAGE_TYPE = {}));
      (function(INTRO_ELIGIBILITY_STATUS2) {
        INTRO_ELIGIBILITY_STATUS2[INTRO_ELIGIBILITY_STATUS2["INTRO_ELIGIBILITY_STATUS_UNKNOWN"] = 0] = "INTRO_ELIGIBILITY_STATUS_UNKNOWN";
        INTRO_ELIGIBILITY_STATUS2[INTRO_ELIGIBILITY_STATUS2["INTRO_ELIGIBILITY_STATUS_INELIGIBLE"] = 1] = "INTRO_ELIGIBILITY_STATUS_INELIGIBLE";
        INTRO_ELIGIBILITY_STATUS2[INTRO_ELIGIBILITY_STATUS2["INTRO_ELIGIBILITY_STATUS_ELIGIBLE"] = 2] = "INTRO_ELIGIBILITY_STATUS_ELIGIBLE";
        INTRO_ELIGIBILITY_STATUS2[INTRO_ELIGIBILITY_STATUS2["INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS"] = 3] = "INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS";
      })(INTRO_ELIGIBILITY_STATUS || (INTRO_ELIGIBILITY_STATUS = {}));
      (function(PRODUCT_CATEGORY2) {
        PRODUCT_CATEGORY2["NON_SUBSCRIPTION"] = "NON_SUBSCRIPTION";
        PRODUCT_CATEGORY2["SUBSCRIPTION"] = "SUBSCRIPTION";
        PRODUCT_CATEGORY2["UNKNOWN"] = "UNKNOWN";
      })(PRODUCT_CATEGORY || (PRODUCT_CATEGORY = {}));
      (function(PRODUCT_TYPE2) {
        PRODUCT_TYPE2["CONSUMABLE"] = "CONSUMABLE";
        PRODUCT_TYPE2["NON_CONSUMABLE"] = "NON_CONSUMABLE";
        PRODUCT_TYPE2["NON_RENEWABLE_SUBSCRIPTION"] = "NON_RENEWABLE_SUBSCRIPTION";
        PRODUCT_TYPE2["AUTO_RENEWABLE_SUBSCRIPTION"] = "AUTO_RENEWABLE_SUBSCRIPTION";
        PRODUCT_TYPE2["PREPAID_SUBSCRIPTION"] = "PREPAID_SUBSCRIPTION";
        PRODUCT_TYPE2["UNKNOWN"] = "UNKNOWN";
      })(PRODUCT_TYPE || (PRODUCT_TYPE = {}));
      (function(PRORATION_MODE2) {
        PRORATION_MODE2[PRORATION_MODE2["UNKNOWN_SUBSCRIPTION_UPGRADE_DOWNGRADE_POLICY"] = 0] = "UNKNOWN_SUBSCRIPTION_UPGRADE_DOWNGRADE_POLICY";
        PRORATION_MODE2[PRORATION_MODE2["IMMEDIATE_WITH_TIME_PRORATION"] = 1] = "IMMEDIATE_WITH_TIME_PRORATION";
        PRORATION_MODE2[PRORATION_MODE2["IMMEDIATE_AND_CHARGE_PRORATED_PRICE"] = 2] = "IMMEDIATE_AND_CHARGE_PRORATED_PRICE";
        PRORATION_MODE2[PRORATION_MODE2["IMMEDIATE_WITHOUT_PRORATION"] = 3] = "IMMEDIATE_WITHOUT_PRORATION";
        PRORATION_MODE2[PRORATION_MODE2["DEFERRED"] = 6] = "DEFERRED";
        PRORATION_MODE2[PRORATION_MODE2["IMMEDIATE_AND_CHARGE_FULL_PRICE"] = 5] = "IMMEDIATE_AND_CHARGE_FULL_PRICE";
      })(PRORATION_MODE || (PRORATION_MODE = {}));
      (function(RECURRENCE_MODE2) {
        RECURRENCE_MODE2[RECURRENCE_MODE2["INFINITE_RECURRING"] = 1] = "INFINITE_RECURRING";
        RECURRENCE_MODE2[RECURRENCE_MODE2["FINITE_RECURRING"] = 2] = "FINITE_RECURRING";
        RECURRENCE_MODE2[RECURRENCE_MODE2["NON_RECURRING"] = 3] = "NON_RECURRING";
      })(RECURRENCE_MODE || (RECURRENCE_MODE = {}));
      (function(OFFER_PAYMENT_MODE2) {
        OFFER_PAYMENT_MODE2["FREE_TRIAL"] = "FREE_TRIAL";
        OFFER_PAYMENT_MODE2["SINGLE_PAYMENT"] = "SINGLE_PAYMENT";
        OFFER_PAYMENT_MODE2["DISCOUNTED_RECURRING_PAYMENT"] = "DISCOUNTED_RECURRING_PAYMENT";
      })(OFFER_PAYMENT_MODE || (OFFER_PAYMENT_MODE = {}));
      (function(PERIOD_UNIT2) {
        PERIOD_UNIT2["DAY"] = "DAY";
        PERIOD_UNIT2["WEEK"] = "WEEK";
        PERIOD_UNIT2["MONTH"] = "MONTH";
        PERIOD_UNIT2["YEAR"] = "YEAR";
        PERIOD_UNIT2["UNKNOWN"] = "UNKNOWN";
      })(PERIOD_UNIT || (PERIOD_UNIT = {}));
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/enums.js
  var PURCHASE_TYPE, BILLING_FEATURE, REFUND_REQUEST_STATUS, LOG_LEVEL, IN_APP_MESSAGE_TYPE, ENTITLEMENT_VERIFICATION_MODE, VERIFICATION_RESULT, PAYWALL_RESULT, STOREKIT_VERSION, PURCHASES_ARE_COMPLETED_BY_TYPE;
  var init_enums = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/enums.js"() {
      (function(PURCHASE_TYPE2) {
        PURCHASE_TYPE2["INAPP"] = "inapp";
        PURCHASE_TYPE2["SUBS"] = "subs";
      })(PURCHASE_TYPE || (PURCHASE_TYPE = {}));
      (function(BILLING_FEATURE2) {
        BILLING_FEATURE2[BILLING_FEATURE2["SUBSCRIPTIONS"] = 0] = "SUBSCRIPTIONS";
        BILLING_FEATURE2[BILLING_FEATURE2["SUBSCRIPTIONS_UPDATE"] = 1] = "SUBSCRIPTIONS_UPDATE";
        BILLING_FEATURE2[BILLING_FEATURE2["IN_APP_ITEMS_ON_VR"] = 2] = "IN_APP_ITEMS_ON_VR";
        BILLING_FEATURE2[BILLING_FEATURE2["SUBSCRIPTIONS_ON_VR"] = 3] = "SUBSCRIPTIONS_ON_VR";
        BILLING_FEATURE2[BILLING_FEATURE2["PRICE_CHANGE_CONFIRMATION"] = 4] = "PRICE_CHANGE_CONFIRMATION";
      })(BILLING_FEATURE || (BILLING_FEATURE = {}));
      (function(REFUND_REQUEST_STATUS2) {
        REFUND_REQUEST_STATUS2[REFUND_REQUEST_STATUS2["SUCCESS"] = 0] = "SUCCESS";
        REFUND_REQUEST_STATUS2[REFUND_REQUEST_STATUS2["USER_CANCELLED"] = 1] = "USER_CANCELLED";
        REFUND_REQUEST_STATUS2[REFUND_REQUEST_STATUS2["ERROR"] = 2] = "ERROR";
      })(REFUND_REQUEST_STATUS || (REFUND_REQUEST_STATUS = {}));
      (function(LOG_LEVEL2) {
        LOG_LEVEL2["VERBOSE"] = "VERBOSE";
        LOG_LEVEL2["DEBUG"] = "DEBUG";
        LOG_LEVEL2["INFO"] = "INFO";
        LOG_LEVEL2["WARN"] = "WARN";
        LOG_LEVEL2["ERROR"] = "ERROR";
      })(LOG_LEVEL || (LOG_LEVEL = {}));
      (function(IN_APP_MESSAGE_TYPE2) {
        IN_APP_MESSAGE_TYPE2[IN_APP_MESSAGE_TYPE2["BILLING_ISSUE"] = 0] = "BILLING_ISSUE";
        IN_APP_MESSAGE_TYPE2[IN_APP_MESSAGE_TYPE2["PRICE_INCREASE_CONSENT"] = 1] = "PRICE_INCREASE_CONSENT";
        IN_APP_MESSAGE_TYPE2[IN_APP_MESSAGE_TYPE2["GENERIC"] = 2] = "GENERIC";
        IN_APP_MESSAGE_TYPE2[IN_APP_MESSAGE_TYPE2["WIN_BACK_OFFER"] = 3] = "WIN_BACK_OFFER";
      })(IN_APP_MESSAGE_TYPE || (IN_APP_MESSAGE_TYPE = {}));
      (function(ENTITLEMENT_VERIFICATION_MODE2) {
        ENTITLEMENT_VERIFICATION_MODE2["DISABLED"] = "DISABLED";
        ENTITLEMENT_VERIFICATION_MODE2["INFORMATIONAL"] = "INFORMATIONAL";
      })(ENTITLEMENT_VERIFICATION_MODE || (ENTITLEMENT_VERIFICATION_MODE = {}));
      (function(VERIFICATION_RESULT2) {
        VERIFICATION_RESULT2["NOT_REQUESTED"] = "NOT_REQUESTED";
        VERIFICATION_RESULT2["VERIFIED"] = "VERIFIED";
        VERIFICATION_RESULT2["FAILED"] = "FAILED";
        VERIFICATION_RESULT2["VERIFIED_ON_DEVICE"] = "VERIFIED_ON_DEVICE";
      })(VERIFICATION_RESULT || (VERIFICATION_RESULT = {}));
      (function(PAYWALL_RESULT2) {
        PAYWALL_RESULT2["NOT_PRESENTED"] = "NOT_PRESENTED";
        PAYWALL_RESULT2["ERROR"] = "ERROR";
        PAYWALL_RESULT2["CANCELLED"] = "CANCELLED";
        PAYWALL_RESULT2["PURCHASED"] = "PURCHASED";
        PAYWALL_RESULT2["RESTORED"] = "RESTORED";
      })(PAYWALL_RESULT || (PAYWALL_RESULT = {}));
      (function(STOREKIT_VERSION2) {
        STOREKIT_VERSION2["STOREKIT_1"] = "STOREKIT_1";
        STOREKIT_VERSION2["STOREKIT_2"] = "STOREKIT_2";
        STOREKIT_VERSION2["DEFAULT"] = "DEFAULT";
      })(STOREKIT_VERSION || (STOREKIT_VERSION = {}));
      (function(PURCHASES_ARE_COMPLETED_BY_TYPE2) {
        PURCHASES_ARE_COMPLETED_BY_TYPE2["MY_APP"] = "MY_APP";
        PURCHASES_ARE_COMPLETED_BY_TYPE2["REVENUECAT"] = "REVENUECAT";
      })(PURCHASES_ARE_COMPLETED_BY_TYPE || (PURCHASES_ARE_COMPLETED_BY_TYPE = {}));
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/purchasesConfiguration.js
  var init_purchasesConfiguration = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/purchasesConfiguration.js"() {
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/callbackTypes.js
  var init_callbackTypes = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/callbackTypes.js"() {
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/webRedemption.js
  var WebPurchaseRedemptionResultType;
  var init_webRedemption = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/webRedemption.js"() {
      (function(WebPurchaseRedemptionResultType2) {
        WebPurchaseRedemptionResultType2["SUCCESS"] = "SUCCESS";
        WebPurchaseRedemptionResultType2["ERROR"] = "ERROR";
        WebPurchaseRedemptionResultType2["PURCHASE_BELONGS_TO_OTHER_USER"] = "PURCHASE_BELONGS_TO_OTHER_USER";
        WebPurchaseRedemptionResultType2["INVALID_TOKEN"] = "INVALID_TOKEN";
        WebPurchaseRedemptionResultType2["EXPIRED"] = "EXPIRED";
      })(WebPurchaseRedemptionResultType || (WebPurchaseRedemptionResultType = {}));
    }
  });

  // node_modules/@revenuecat/purchases-typescript-internal-esm/dist/index.js
  var init_dist2 = __esm({
    "node_modules/@revenuecat/purchases-typescript-internal-esm/dist/index.js"() {
      init_errors();
      init_customerInfo();
      init_offerings();
      init_enums();
      init_purchasesConfiguration();
      init_callbackTypes();
      init_webRedemption();
    }
  });

  // node_modules/@revenuecat/purchases-capacitor/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    PurchasesWeb: () => PurchasesWeb
  });
  var PurchasesWeb;
  var init_web = __esm({
    "node_modules/@revenuecat/purchases-capacitor/dist/esm/web.js"() {
      init_dist();
      init_dist2();
      PurchasesWeb = class extends WebPlugin {
        constructor() {
          super(...arguments);
          this.shouldMockWebResults = false;
          this.webNotSupportedErrorMessage = "Web not supported in this plugin.";
          this.mockEmptyCustomerInfo = {
            entitlements: {
              all: {},
              active: {},
              verification: VERIFICATION_RESULT.NOT_REQUESTED
            },
            activeSubscriptions: [],
            allPurchasedProductIdentifiers: [],
            latestExpirationDate: null,
            firstSeen: "2023-08-31T15:11:21.445Z",
            originalAppUserId: "mock-web-user-id",
            requestDate: "2023-08-31T15:11:21.445Z",
            allExpirationDates: {},
            allPurchaseDates: {},
            originalApplicationVersion: null,
            originalPurchaseDate: null,
            managementURL: null,
            nonSubscriptionTransactions: [],
            subscriptionsByProductIdentifier: {}
          };
        }
        configure(_configuration) {
          return this.mockNonReturningFunctionIfEnabled("configure");
        }
        setMockWebResults(options) {
          this.shouldMockWebResults = options.shouldMockWebResults;
          return Promise.resolve();
        }
        setSimulatesAskToBuyInSandbox(_simulatesAskToBuyInSandbox) {
          return this.mockNonReturningFunctionIfEnabled("setSimulatesAskToBuyInSandbox");
        }
        addCustomerInfoUpdateListener(_customerInfoUpdateListener) {
          return this.mockReturningFunctionIfEnabled("addCustomerInfoUpdateListener", "mock-callback-id");
        }
        removeCustomerInfoUpdateListener(_options) {
          return this.mockReturningFunctionIfEnabled("removeCustomerInfoUpdateListener", { wasRemoved: false });
        }
        addShouldPurchasePromoProductListener(_shouldPurchasePromoProductListener) {
          return this.mockReturningFunctionIfEnabled("addShouldPurchasePromoProductListener", "mock-callback-id");
        }
        removeShouldPurchasePromoProductListener(_listenerToRemove) {
          return this.mockReturningFunctionIfEnabled("removeShouldPurchasePromoProductListener", { wasRemoved: false });
        }
        getOfferings() {
          const mockOfferings = {
            all: {},
            current: null
          };
          return this.mockReturningFunctionIfEnabled("getOfferings", mockOfferings);
        }
        getCurrentOfferingForPlacement(_options) {
          const mockOffering = null;
          return this.mockReturningFunctionIfEnabled("getCurrentOfferingForPlacement", mockOffering);
        }
        syncAttributesAndOfferingsIfNeeded() {
          const mockOfferings = {
            all: {},
            current: null
          };
          return this.mockReturningFunctionIfEnabled("syncAttributesAndOfferingsIfNeeded", mockOfferings);
        }
        getProducts(_options) {
          const mockProducts = { products: [] };
          return this.mockReturningFunctionIfEnabled("getProducts", mockProducts);
        }
        purchaseStoreProduct(_options) {
          const mockPurchaseResult = {
            productIdentifier: _options.product.identifier,
            customerInfo: this.mockEmptyCustomerInfo,
            transaction: this.mockTransaction(_options.product.identifier)
          };
          return this.mockReturningFunctionIfEnabled("purchaseStoreProduct", mockPurchaseResult);
        }
        purchaseDiscountedProduct(_options) {
          const mockPurchaseResult = {
            productIdentifier: _options.product.identifier,
            customerInfo: this.mockEmptyCustomerInfo,
            transaction: this.mockTransaction(_options.product.identifier)
          };
          return this.mockReturningFunctionIfEnabled("purchaseDiscountedProduct", mockPurchaseResult);
        }
        purchasePackage(_options) {
          const mockPurchaseResult = {
            productIdentifier: _options.aPackage.product.identifier,
            customerInfo: this.mockEmptyCustomerInfo,
            transaction: this.mockTransaction(_options.aPackage.product.identifier)
          };
          return this.mockReturningFunctionIfEnabled("purchasePackage", mockPurchaseResult);
        }
        purchaseSubscriptionOption(_options) {
          const mockPurchaseResult = {
            productIdentifier: _options.subscriptionOption.productId,
            customerInfo: this.mockEmptyCustomerInfo,
            transaction: this.mockTransaction(_options.subscriptionOption.productId)
          };
          return this.mockReturningFunctionIfEnabled("purchaseSubscriptionOption", mockPurchaseResult);
        }
        purchaseDiscountedPackage(_options) {
          const mockPurchaseResult = {
            productIdentifier: _options.aPackage.product.identifier,
            customerInfo: this.mockEmptyCustomerInfo,
            transaction: this.mockTransaction(_options.aPackage.product.identifier)
          };
          return this.mockReturningFunctionIfEnabled("purchaseDiscountedPackage", mockPurchaseResult);
        }
        restorePurchases() {
          const mockResponse = { customerInfo: this.mockEmptyCustomerInfo };
          return this.mockReturningFunctionIfEnabled("restorePurchases", mockResponse);
        }
        recordPurchase(options) {
          const mockResponse = {
            transaction: this.mockTransaction(options.productID)
          };
          return this.mockReturningFunctionIfEnabled("recordPurchase", mockResponse);
        }
        getAppUserID() {
          return this.mockReturningFunctionIfEnabled("getAppUserID", {
            appUserID: "test-web-user-id"
          });
        }
        logIn(_appUserID) {
          const mockLogInResult = {
            customerInfo: this.mockEmptyCustomerInfo,
            created: false
          };
          return this.mockReturningFunctionIfEnabled("logIn", mockLogInResult);
        }
        logOut() {
          const mockResponse = { customerInfo: this.mockEmptyCustomerInfo };
          return this.mockReturningFunctionIfEnabled("logOut", mockResponse);
        }
        setLogLevel(_level) {
          return this.mockNonReturningFunctionIfEnabled("setLogLevel");
        }
        setLogHandler(_logHandler) {
          return this.mockNonReturningFunctionIfEnabled("setLogHandler");
        }
        getCustomerInfo() {
          const mockResponse = { customerInfo: this.mockEmptyCustomerInfo };
          return this.mockReturningFunctionIfEnabled("getCustomerInfo", mockResponse);
        }
        syncPurchases() {
          return this.mockNonReturningFunctionIfEnabled("syncPurchases");
        }
        syncObserverModeAmazonPurchase(_options) {
          return this.mockNonReturningFunctionIfEnabled("syncObserverModeAmazonPurchase");
        }
        syncAmazonPurchase(_options) {
          return this.mockNonReturningFunctionIfEnabled("syncAmazonPurchase");
        }
        enableAdServicesAttributionTokenCollection() {
          return this.mockNonReturningFunctionIfEnabled("enableAdServicesAttributionTokenCollection");
        }
        isAnonymous() {
          const mockResponse = { isAnonymous: false };
          return this.mockReturningFunctionIfEnabled("isAnonymous", mockResponse);
        }
        checkTrialOrIntroductoryPriceEligibility(_productIdentifiers) {
          return this.mockReturningFunctionIfEnabled("checkTrialOrIntroductoryPriceEligibility", {});
        }
        getPromotionalOffer(_options) {
          return this.mockReturningFunctionIfEnabled("getPromotionalOffer", void 0);
        }
        getEligibleWinBackOffersForProduct(_options) {
          return this.mockReturningFunctionIfEnabled("getEligibleWinBackOffersForProduct", { eligibleWinBackOffers: [] });
        }
        getEligibleWinBackOffersForPackage(_options) {
          return this.mockReturningFunctionIfEnabled("getEligibleWinBackOffersForPackage", { eligibleWinBackOffers: [] });
        }
        purchaseProductWithWinBackOffer(_options) {
          return this.mockReturningFunctionIfEnabled("purchaseProductWithWinBackOffer", void 0);
        }
        purchasePackageWithWinBackOffer(_options) {
          return this.mockReturningFunctionIfEnabled("purchasePackageWithWinBackOffer", void 0);
        }
        invalidateCustomerInfoCache() {
          return this.mockNonReturningFunctionIfEnabled("invalidateCustomerInfoCache");
        }
        presentCodeRedemptionSheet() {
          return this.mockNonReturningFunctionIfEnabled("presentCodeRedemptionSheet");
        }
        setAttributes(_attributes) {
          return this.mockNonReturningFunctionIfEnabled("setAttributes");
        }
        setEmail(_email) {
          return this.mockNonReturningFunctionIfEnabled("setEmail");
        }
        setPhoneNumber(_phoneNumber) {
          return this.mockNonReturningFunctionIfEnabled("setPhoneNumber");
        }
        setDisplayName(_displayName) {
          return this.mockNonReturningFunctionIfEnabled("setDisplayName");
        }
        setPushToken(_pushToken) {
          return this.mockNonReturningFunctionIfEnabled("setPushToken");
        }
        setProxyURL(_url) {
          return this.mockNonReturningFunctionIfEnabled("setProxyURL");
        }
        collectDeviceIdentifiers() {
          return this.mockNonReturningFunctionIfEnabled("collectDeviceIdentifiers");
        }
        setAdjustID(_adjustID) {
          return this.mockNonReturningFunctionIfEnabled("setAdjustID");
        }
        setAppsflyerID(_appsflyerID) {
          return this.mockNonReturningFunctionIfEnabled("setAppsflyerID");
        }
        setFBAnonymousID(_fbAnonymousID) {
          return this.mockNonReturningFunctionIfEnabled("setFBAnonymousID");
        }
        setMparticleID(_mparticleID) {
          return this.mockNonReturningFunctionIfEnabled("setMparticleID");
        }
        setCleverTapID(_cleverTapID) {
          return this.mockNonReturningFunctionIfEnabled("setCleverTapID");
        }
        setMixpanelDistinctID(_mixpanelDistinctID) {
          return this.mockNonReturningFunctionIfEnabled("setMixpanelDistinctID");
        }
        setFirebaseAppInstanceID(_firebaseAppInstanceID) {
          return this.mockNonReturningFunctionIfEnabled("setFirebaseAppInstanceID");
        }
        setOnesignalID(_onesignalID) {
          return this.mockNonReturningFunctionIfEnabled("setOnesignalID");
        }
        setOnesignalUserID(_onesignalUserID) {
          return this.mockNonReturningFunctionIfEnabled("setOnesignalUserID");
        }
        setAirshipChannelID(_airshipChannelID) {
          return this.mockNonReturningFunctionIfEnabled("setAirshipChannelID");
        }
        setMediaSource(_mediaSource) {
          return this.mockNonReturningFunctionIfEnabled("setMediaSource");
        }
        setCampaign(_campaign) {
          return this.mockNonReturningFunctionIfEnabled("setCampaign");
        }
        setAdGroup(_adGroup) {
          return this.mockNonReturningFunctionIfEnabled("setAdGroup");
        }
        setAd(_ad) {
          return this.mockNonReturningFunctionIfEnabled("setAd");
        }
        setKeyword(_keyword) {
          return this.mockNonReturningFunctionIfEnabled("setKeyword");
        }
        setCreative(_creative) {
          return this.mockNonReturningFunctionIfEnabled("setCreative");
        }
        canMakePayments(_features) {
          return this.mockReturningFunctionIfEnabled("canMakePayments", {
            canMakePayments: true
          });
        }
        beginRefundRequestForActiveEntitlement() {
          const mockResult = {
            refundRequestStatus: REFUND_REQUEST_STATUS.USER_CANCELLED
          };
          return this.mockReturningFunctionIfEnabled("beginRefundRequestForActiveEntitlement", mockResult);
        }
        beginRefundRequestForEntitlement(_entitlementInfo) {
          const mockResult = {
            refundRequestStatus: REFUND_REQUEST_STATUS.USER_CANCELLED
          };
          return this.mockReturningFunctionIfEnabled("beginRefundRequestForEntitlement", mockResult);
        }
        beginRefundRequestForProduct(_storeProduct) {
          const mockResult = {
            refundRequestStatus: REFUND_REQUEST_STATUS.USER_CANCELLED
          };
          return this.mockReturningFunctionIfEnabled("beginRefundRequestForProduct", mockResult);
        }
        showInAppMessages(_options) {
          return this.mockNonReturningFunctionIfEnabled("showInAppMessages");
        }
        isConfigured() {
          const mockResult = { isConfigured: true };
          return this.mockReturningFunctionIfEnabled("isConfigured", mockResult);
        }
        mockTransaction(productIdentifier) {
          return {
            productIdentifier,
            purchaseDate: (/* @__PURE__ */ new Date()).toISOString(),
            transactionIdentifier: ""
          };
        }
        mockNonReturningFunctionIfEnabled(functionName) {
          if (!this.shouldMockWebResults) {
            return Promise.reject(this.webNotSupportedErrorMessage);
          }
          console.log(`${functionName} called on web with mocking enabled. No-op`);
          return Promise.resolve();
        }
        mockReturningFunctionIfEnabled(functionName, returnValue) {
          if (!this.shouldMockWebResults) {
            return Promise.reject(this.webNotSupportedErrorMessage);
          }
          console.log(`${functionName} called on web with mocking enabled. Returning mocked value`);
          return Promise.resolve(returnValue);
        }
      };
    }
  });

  // node_modules/@revenuecat/purchases-capacitor/dist/esm/index.js
  init_dist();

  // node_modules/@revenuecat/purchases-capacitor/dist/esm/definitions.js
  init_dist2();

  // node_modules/@revenuecat/purchases-capacitor/dist/esm/index.js
  var Purchases = registerPlugin("Purchases", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.PurchasesWeb())
  });

  // native/purchases-adapter.js
  function createNativePurchases({ getUser, platform: platform2, publicApiKey, products, api: api2, onConfirmed, beforePurchase }) {
    let configured = false, identity = null, inFlight = false, queue = Promise.resolve();
    if (!["ios", "android"].includes(platform2)) throw Error("native platform required");
    const store = platform2 === "ios" ? "APP_STORE" : "PLAY_STORE";
    const user2 = () => {
      const u = getUser();
      if (!u?.uid || u.isAnonymous) throw Error("\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u062D\u0633\u0627\u0628 \u0645\u062D\u0641\u0648\u0638 \u0642\u0628\u0644 \u0627\u0644\u0634\u0631\u0627\u0621");
      return u;
    };
    const guard = (uid) => {
      if (getUser()?.uid !== uid) throw Error("\u062A\u063A\u064A\u0631 \u0627\u0644\u062D\u0633\u0627\u0628\u061B \u062A\u064F\u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0630\u064A \u0628\u062F\u0623 \u0627\u0644\u0634\u0631\u0627\u0621");
    };
    function serial(fn) {
      const next = queue.then(fn, fn);
      queue = next.catch(() => {
      });
      return next;
    }
    async function identify(uid) {
      guard(uid);
      if (!configured) {
        if (typeof publicApiKey !== "string" || !(platform2 === "ios" ? publicApiKey.startsWith("appl_") : publicApiKey.startsWith("goog_"))) throw Error("\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0644\u0645 \u062A\u064F\u062C\u0647\u0632 \u0628\u0639\u062F");
        await Purchases.configure({ apiKey: publicApiKey, appUserID: uid });
        configured = true;
        identity = uid;
      } else if (identity !== uid) {
        await Purchases.logIn({ appUserID: uid });
        identity = uid;
      }
      guard(uid);
    }
    async function list(kind) {
      return serial(async () => {
        const uid = user2().uid;
        await identify(uid);
        const ids = Object.entries(products).filter(([, p]) => p.kind === kind).map(([id]) => id);
        const result = await Purchases.getProducts({ productIdentifiers: ids, type: kind === "gold" ? "NON_SUBSCRIPTION" : "SUBSCRIPTION" });
        guard(uid);
        return result.products.filter((p) => ids.includes(p.identifier));
      });
    }
    const pendingKey = (uid) => "mjabid-native-pending-" + uid;
    function pending(uid) {
      try {
        return JSON.parse(localStorage.getItem(pendingKey(uid)) || "[]");
      } catch (_) {
        return [];
      }
    }
    function remember(uid, transactionId) {
      const all = pending(uid);
      if (!all.includes(transactionId)) {
        all.push(transactionId);
        localStorage.setItem(pendingKey(uid), JSON.stringify(all));
      }
    }
    async function verify(uid, transactionId) {
      guard(uid);
      const result = await api2("/native/purchase-status", { store, transactionId });
      guard(uid);
      if (["completed", "subscription_recorded", "refund_review", "subscription_cancelled"].includes(result.status)) {
        localStorage.setItem(pendingKey(uid), JSON.stringify(pending(uid).filter((id) => id !== transactionId)));
        if (["completed", "subscription_recorded"].includes(result.status)) await onConfirmed?.(result);
      }
      return result;
    }
    async function purchase(product) {
      if (inFlight) throw Error("\u062A\u0648\u062C\u062F \u0639\u0645\u0644\u064A\u0629 \u0634\u0631\u0627\u0621 \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630");
      const uid = user2().uid;
      if (!Object.prototype.hasOwnProperty.call(products, product?.identifier || "")) throw Error("\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629");
      inFlight = true;
      try {
        return await serial(async () => {
          await identify(uid);
          guard(uid);
          await beforePurchase?.();
          guard(uid);
          const kind = products[product.identifier].kind;
          const result = await Purchases.getProducts({ productIdentifiers: [product.identifier], type: kind === "gold" ? "NON_SUBSCRIPTION" : "SUBSCRIPTION" });
          const found = result.products.find((p) => p.identifier === product.identifier);
          guard(uid);
          if (!found) throw Error("\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0641\u064A \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643");
          if (found.priceString !== product.priceString) throw Error("\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u0639\u0631\u061B \u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u0628\u0627\u0642\u0629 \u0644\u0645\u0631\u0627\u062C\u0639\u062A\u0647");
          const paid = await Purchases.purchaseStoreProduct({ product: found });
          const transactionId = paid.transaction?.transactionIdentifier;
          if (typeof transactionId !== "string" || !transactionId) return { status: "awaiting_confirmation" };
          remember(uid, transactionId);
          guard(uid);
          return await verify(uid, transactionId);
        });
      } catch (e) {
        if (e?.userCancelled === true || String(e?.code) === "1") return { status: "cancelled" };
        throw e;
      } finally {
        inFlight = false;
      }
    }
    async function resume2() {
      return serial(async () => {
        const uid = user2().uid;
        await identify(uid);
        const results = [];
        for (const id of pending(uid)) results.push(await verify(uid, id));
        return results;
      });
    }
    async function restore2() {
      if (inFlight) throw Error("\u0627\u0646\u062A\u0638\u0631 \u0627\u0643\u062A\u0645\u0627\u0644 \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0634\u0631\u0627\u0621");
      return serial(async () => {
        const uid = user2().uid;
        await identify(uid);
        await Purchases.restorePurchases();
        guard(uid);
        return api2("/vip-status", {});
      });
    }
    return { list, purchase, resume: resume2, restore: restore2, isBusy: () => inFlight };
  }

  // native/shop-entry.js
  var KEYS = { ios: "appl_DaFDRgTQyjQCUPyelvtRtyklBBC", android: "" };
  var PRODUCTS = {
    "mjabid.gold.500": { kind: "gold", tierKey: "tier1" },
    "mjabid.gold.1100": { kind: "gold", tierKey: "tier2" },
    "mjabid.gold.3000": { kind: "gold", tierKey: "tier3" },
    "mjabid.gold.6500": { kind: "gold", tierKey: "tier4" },
    "mjabid.gold.14000": { kind: "gold", tierKey: "tier5" },
    "mjabid.vip.monthly": { kind: "vip", title: "\u0634\u0647\u0631 \u0648\u0627\u062D\u062F", period: "\u0634\u0647\u0631" },
    "mjabid.vip.quarterly": { kind: "vip", title: "\u062B\u0644\u0627\u062B\u0629 \u0623\u0634\u0647\u0631", period: "3 \u0623\u0634\u0647\u0631" },
    "mjabid.vip.yearly": { kind: "vip", title: "\u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629", period: "\u0633\u0646\u0629" }
  };
  var platform = () => window.Capacitor?.getPlatform?.();
  var native = () => ["ios", "android"].includes(platform());
  var user = () => typeof FB !== "undefined" && FB.user && FB.auth?.currentUser?.uid === FB.user.uid ? FB.user : null;
  var number = (n) => Number(n).toLocaleString("ar-SA");
  var adapter = null;
  var dialog = null;
  var epoch = 0;
  var renderEpoch = 0;
  var previousFocus = null;
  async function api(path, body) {
    const u = user();
    if (body && (!u || u.isAnonymous)) throw Error("\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u062D\u0633\u0627\u0628 \u0645\u062D\u0641\u0648\u0638 \u0623\u0648\u0644\u064B\u0627");
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15e3);
    try {
      const headers = { "content-type": "application/json" };
      if (body) headers.authorization = "Bearer " + await u.getIdToken();
      const r = await fetch("https://" + GAME_SRV + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : void 0, signal: controller.signal });
      const d = await r.json();
      if (body && user()?.uid !== u.uid) throw Error("\u062A\u063A\u064A\u0631 \u0627\u0644\u062D\u0633\u0627\u0628\u061B \u0639\u064F\u062F \u0628\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0630\u064A \u0628\u062F\u0623 \u0627\u0644\u0634\u0631\u0627\u0621");
      if (!r.ok || !d.ok) throw Error("\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627.");
      return d;
    } finally {
      clearTimeout(timer);
    }
  }
  async function ready() {
    if (!native() || !KEYS[platform()]) throw Error("\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u0628\u0639\u062F.");
    const d = await api("/native/readiness");
    if (!d.enabled || d.stores?.[platform()] !== true) throw Error("\u0627\u0644\u0645\u062A\u062C\u0631 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627.");
    return d;
  }
  function client() {
    if (adapter) return adapter;
    adapter = createNativePurchases({
      getUser: user,
      platform: platform(),
      publicApiKey: KEYS[platform()],
      products: PRODUCTS,
      api,
      beforePurchase: ready,
      onConfirmed: async (r) => {
        if (r.kind === "gold") {
          await freshGold();
          refreshHome();
        }
        if (r.kind === "vip") await window.VipClient?.refresh(true);
      }
    });
    return adapter;
  }
  function close() {
    epoch++;
    dialog?.remove();
    dialog = null;
    previousFocus?.focus?.();
  }
  function shell() {
    close();
    previousFocus = document.activeElement;
    dialog = document.createElement("div");
    dialog.className = "gcOverlay";
    dialog.id = "nativePurchaseDialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "nativePurchaseTitle");
    dialog.innerHTML = '<section class="gcDialog"><button class="gcClose" type="button" aria-label="\u0625\u063A\u0644\u0627\u0642">\xD7</button><div class="gcMedallion" aria-hidden="true">\u2726</div><small class="gcEyebrow">\u0645\u062A\u062C\u0631 \u0645\u062C\u0627\u0628\u064A\u062F</small><h2 id="nativePurchaseTitle"></h2><p class="nativeStatus" role="status" aria-live="polite"></p><div class="nativeDetails"></div><div class="nativeActions"></div><small class="nativeFootnote"></small></section>';
    document.body.append(dialog);
    dialog.querySelector(".gcClose").onclick = close;
    dialog.onkeydown = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const items = [...dialog.querySelectorAll("button:not(:disabled),a[href]")];
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    dialog.querySelector(".gcClose").focus();
    return { generation: epoch, uid: user()?.uid };
  }
  var live = (c) => dialog && epoch === c.generation && user()?.uid === c.uid;
  function state(title, message, loading = false) {
    if (!dialog) return;
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector(".nativeStatus").textContent = message;
    dialog.querySelector(".gcMedallion").classList.toggle("gcLoading", loading);
    dialog.querySelector(".nativeDetails").replaceChildren();
    dialog.querySelector(".nativeActions").replaceChildren();
    dialog.querySelector(".nativeFootnote").textContent = "";
  }
  function action(label, fn, secondary = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = secondary ? "gcSecondary" : "gcPrimary";
    b.textContent = label;
    b.onclick = fn;
    dialog.querySelector(".nativeActions").append(b);
    return b;
  }
  function detail(label, value) {
    const row = document.createElement("div");
    row.className = "gcDetail";
    const a = document.createElement("span"), b = document.createElement("strong");
    a.textContent = label;
    b.textContent = value;
    row.append(a, b);
    dialog.querySelector(".nativeDetails").append(row);
  }
  function foot(text) {
    dialog.querySelector(".nativeFootnote").textContent = text;
  }
  function unavailable(e) {
    state("\u062A\u0639\u0630\u0651\u0631 \u0641\u062A\u062D \u0627\u0644\u0645\u062A\u062C\u0631", e.message);
    action("\u0625\u063A\u0644\u0627\u0642", close, true);
  }
  async function renderGold(wrap) {
    const gen = ++renderEpoch, uid = user()?.uid;
    wrap.textContent = "\u062C\u0627\u0631\u064D \u062A\u062D\u0645\u064A\u0644 \u0623\u0633\u0639\u0627\u0631 \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643\u2026";
    try {
      await ready();
      const [catalog, products] = await Promise.all([api("/commerce"), client().list("gold")]);
      if (gen !== renderEpoch || uid !== user()?.uid || !wrap.isConnected) return;
      wrap.replaceChildren();
      for (const p of catalog.packages) {
        const id = Object.keys(PRODUCTS).find((id2) => PRODUCTS[id2].tierKey === p.key), store = products.find((x) => x.identifier === id);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "uiGoldPackage gcPackage";
        b.disabled = !store;
        const name = document.createElement("strong"), price = document.createElement("span");
        name.textContent = number(p.gold) + " \u0630\u0647\u0628";
        price.className = "uiGoldPackagePrice";
        price.textContent = store?.priceString || "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u064B\u0627";
        b.append(name, price);
        b.onclick = () => openGold(p.key);
        wrap.append(b);
      }
    } catch (e) {
      if (gen !== renderEpoch || uid !== user()?.uid || !wrap.isConnected) return;
      wrap.textContent = e.message;
      const retry = document.createElement("button");
      retry.className = "btn";
      retry.textContent = "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629";
      retry.onclick = () => renderGold(wrap);
      wrap.append(retry);
    }
  }
  async function openGold(key) {
    const ctx = shell();
    state("\u0646\u062C\u0647\u0632 \u0628\u0627\u0642\u062A\u0643", "\u062C\u0627\u0631\u064D \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0633\u0639\u0631 \u0645\u0646 \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643\u2026", true);
    try {
      await ready();
      const [catalog, products] = await Promise.all([api("/commerce"), client().list("gold")]);
      if (!live(ctx)) return;
      const pkg = catalog.packages.find((x) => x.key === key), id = Object.keys(PRODUCTS).find((id2) => PRODUCTS[id2].tierKey === key), p = products.find((x) => x.identifier === id);
      if (!pkg || !p) throw Error("\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0641\u064A \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643.");
      state(pkg.offer?.title || "\u0632\u0627\u062F\u0643 \u0644\u0644\u062C\u0648\u0644\u0629", number(pkg.gold) + " \u0630\u0647\u0628 \u0644\u062D\u0633\u0627\u0628\u0643");
      detail("\u0630\u0647\u0628 \u0627\u0644\u0628\u0627\u0642\u0629", number(pkg.baseGold));
      if (pkg.offer) detail("\u0647\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636", "+ " + number(pkg.offer.bonusGold));
      detail("\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A", p.priceString);
      action("\u0634\u0631\u0627\u0621 \xB7 " + p.priceString, () => buy(p, ctx));
      action("\u0631\u062C\u0648\u0639", close, true);
      foot(pkg.offer ? "\u0628\u0648\u0646\u0635 \u0627\u0644\u0639\u0631\u0636 \u064A\u0639\u062A\u0645\u062F \u0639\u0644\u0649 \u0648\u0642\u062A \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0634\u0631\u0627\u0621 \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631. \u064A\u064F\u0636\u0627\u0641 \u0627\u0644\u0630\u0647\u0628 \u0628\u0639\u062F \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0633\u064A\u0631\u0641\u0631." : "\u064A\u064F\u0636\u0627\u0641 \u0627\u0644\u0630\u0647\u0628 \u0628\u0639\u062F \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0634\u0631\u0627\u0621 \u0645\u0646 \u0627\u0644\u0633\u064A\u0631\u0641\u0631.");
    } catch (e) {
      if (live(ctx)) unavailable(e);
    }
  }
  function legal() {
    const row = document.createElement("p");
    row.className = "nativeLegal";
    for (const [title, href] of [["\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629", "privacy.html"], ["\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645", "terms.html"]]) {
      const a = document.createElement("a");
      a.textContent = title;
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      row.append(a, document.createTextNode(" \xB7 "));
    }
    dialog.querySelector(".nativeDetails").append(row);
  }
  async function openVip() {
    const ctx = shell();
    state("\u0639\u0636\u0648\u064A\u0629 \u0645\u062C\u0627\u0628\u064A\u062F VIP", "\u0644\u0639\u0628 \u0628\u062F\u0648\u0646 \u0625\u0639\u0644\u0627\u0646\u0627\u062A\u060C \u062A\u0641\u0627\u0639\u0644\u0627\u062A \u0645\u062C\u0627\u0646\u064A\u0629\u060C \u062F\u062E\u0648\u0644 \u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621\u060C \u0648\u0634\u0627\u0631\u0629 VIP.", true);
    try {
      await ready();
      const products = await client().list("vip");
      if (!live(ctx)) return;
      state("\u0627\u062E\u062A\u0631 \u0645\u062F\u0629 \u0639\u0636\u0648\u064A\u062A\u0643", "\u0646\u0641\u0633 \u0627\u0644\u0645\u0632\u0627\u064A\u0627 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u062F\u062F. \u0631\u0633\u0648\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0629 \u0648\u0627\u0644\u062A\u0646\u0627\u0641\u0633\u064A \u0645\u0633\u062A\u0642\u0644\u0629.");
      for (const [id, info] of Object.entries(PRODUCTS).filter(([, p]) => p.kind === "vip")) {
        const p = products.find((p2) => p2.identifier === id);
        const b = action(info.title + " \xB7 " + (p?.priceString || "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u064B\u0627"), () => {
          if (!live(ctx)) return;
          state("\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643", info.title + " \u0641\u064A \u0639\u0636\u0648\u064A\u0629 \u0645\u062C\u0627\u0628\u064A\u062F VIP");
          detail("\u0627\u0644\u0633\u0639\u0631", p.priceString + " / " + info.period);
          action("\u0627\u0634\u062A\u0631\u0627\u0643 \xB7 " + p.priceString, () => buy(p, ctx));
          action("\u0631\u062C\u0648\u0639", openVip, true);
          foot("\u0627\u0634\u062A\u0631\u0627\u0643 \u064A\u062A\u062C\u062F\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627 \u0643\u0644 " + info.period + " \u0628\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u0645\u0627 \u0644\u0645 \u062A\u064F\u0644\u063A\u0650\u0647. \u064A\u0645\u0643\u0646\u0643 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0648\u0625\u0644\u063A\u0627\u0624\u0647 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643.");
          legal();
        });
        b.disabled = !p;
      }
      action("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A", () => restore(ctx), true);
      foot("\u064A\u062A\u062C\u062F\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627. \u064A\u0645\u0643\u0646\u0643 \u0625\u0644\u063A\u0627\u0624\u0647 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643.");
      legal();
    } catch (e) {
      if (live(ctx)) {
        unavailable(e);
        if (native() && KEYS[platform()]) action("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A", () => restore(ctx), true);
      }
    }
  }
  async function showResult(results, ctx) {
    if (!live(ctx)) return true;
    const done = results.find((r) => r.status === "completed" && r.kind === "gold");
    if (done) {
      state("\u0648\u0635\u0644 \u0630\u0647\u0628\u0643!", "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0625\u0636\u0627\u0641\u0629 " + number(done.gold) + " \u0630\u0647\u0628 \u0625\u0644\u0649 \u062D\u0633\u0627\u0628\u0643.");
      detail("\u0631\u0635\u064A\u062F\u0643", number(done.wallet?.gold ?? 0) + " \u0630\u0647\u0628");
      action("\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0645\u062C\u0644\u0633", close);
      return true;
    }
    if (results.some((r) => r.status === "subscription_recorded")) {
      const vip = await window.VipClient?.refresh(true);
      if (!live(ctx)) return true;
      if (vip?.active) {
        state("\u0639\u0636\u0648\u064A\u062A\u0643 \u0645\u0641\u0639\u0651\u0644\u0629", "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0634\u062A\u0631\u0627\u0643 VIP \u0645\u0646 \u0627\u0644\u0633\u064A\u0631\u0641\u0631.");
        action("\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0645\u062C\u0644\u0633", close);
        return true;
      }
    }
    if (results.some((r) => ["refund_review", "subscription_cancelled"].includes(r.status))) {
      state("\u0631\u0627\u062C\u0639 \u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", "\u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u0633\u062C\u0644\u0629 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0623\u0648 \u0627\u0644\u0625\u0644\u063A\u0627\u0621\u061B \u0644\u0646 \u0646\u0637\u0644\u0628 \u0645\u0646\u0643 \u0627\u0644\u062F\u0641\u0639 \u0645\u062C\u062F\u062F\u064B\u0627.");
      action("\u0625\u063A\u0644\u0627\u0642", close);
      return true;
    }
    return false;
  }
  async function confirm(ctx, initial = []) {
    if (!live(ctx)) return;
    state("\u0646\u062A\u062D\u0642\u0642 \u0645\u0646 \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0634\u0631\u0627\u0621", "\u0646\u0646\u062A\u0638\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u0627\u0644\u0633\u064A\u0631\u0641\u0631. \u064A\u0645\u0643\u0646\u0643 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0646\u0627\u0641\u0630\u0629\u061B \u0644\u0627 \u062A\u0639\u0650\u062F \u0627\u0644\u062F\u0641\u0639 \u0644\u0646\u0641\u0633 \u0627\u0644\u0639\u0645\u0644\u064A\u0629.", true);
    let results = initial;
    for (let i = 0; i < 20 && live(ctx); i++) {
      try {
        if (await showResult(results, ctx)) return;
        const resumed = await client().resume();
        results = [...results.filter((x) => x.status === "subscription_recorded"), ...resumed];
        if (await showResult(results, ctx)) return;
      } catch (_) {
      }
      if (i < 19) await new Promise((r) => setTimeout(r, 4e3));
    }
    if (live(ctx)) {
      state("\u0637\u0644\u0628\u0643 \u0642\u064A\u062F \u0627\u0644\u062A\u062D\u0642\u0642", "\u0644\u0645 \u064A\u0635\u0644 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0628\u0639\u062F. \u0644\u0627 \u062A\u062D\u062A\u0627\u062C \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062F\u0641\u0639.");
      action("\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627", () => confirm(ctx, results));
      action("\u0644\u0627\u062D\u0642\u064B\u0627", close, true);
    }
  }
  async function buy(p, ctx) {
    if (!live(ctx) || client().isBusy()) return;
    state("\u062C\u0627\u0631\u064D \u0641\u062A\u062D \u0627\u0644\u062F\u0641\u0639", "\u0623\u0643\u0645\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0641\u064A \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643\u2026", true);
    try {
      const r = await client().purchase(p);
      if (!live(ctx)) return;
      if (r.status === "cancelled") {
        state("\u0623\u064F\u0644\u063A\u064A\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629", "\u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0627\u0644\u0634\u0631\u0627\u0621.");
        action("\u0625\u063A\u0644\u0627\u0642", close);
        return;
      }
      await confirm(ctx, [r]);
    } catch (e) {
      if (live(ctx)) {
        state("\u062A\u0639\u0630\u0651\u0631 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0642\u0642", e.message);
        action("\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A", () => confirm(ctx));
        action("\u0625\u063A\u0644\u0627\u0642", close, true);
      }
    }
  }
  async function restore(ctx) {
    if (!live(ctx)) return;
    state("\u0646\u0633\u062A\u0639\u064A\u062F \u0627\u0634\u062A\u0631\u0627\u0643\u0643", "\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u062A\u062C\u0631 \u062C\u0647\u0627\u0632\u0643 \u0648\u0627\u0644\u0633\u064A\u0631\u0641\u0631\u2026", true);
    try {
      const status = await client().restore();
      if (!live(ctx)) return;
      await window.VipClient?.refresh(true);
      if (!live(ctx)) return;
      state(status.active ? "\u0639\u0636\u0648\u064A\u062A\u0643 \u0645\u0641\u0639\u0651\u0644\u0629" : "\u0627\u0643\u062A\u0645\u0644\u062A \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629", status.active ? "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0633\u064A\u0631\u0641\u0631." : "\u0644\u0627 \u064A\u0638\u0647\u0631 \u0627\u0634\u062A\u0631\u0627\u0643 \u0646\u0634\u0637 \u062D\u0627\u0644\u064A\u064B\u0627. \u0625\u0630\u0627 \u0627\u0634\u062A\u0631\u064A\u062A \u0644\u0644\u062A\u0648\u060C \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
      action("\u062A\u062D\u0642\u0642 \u0645\u062C\u062F\u062F\u064B\u0627", () => restore(ctx));
      action("\u0625\u063A\u0644\u0627\u0642", close, true);
      foot("\u0627\u0644\u0630\u0647\u0628 \u0627\u0644\u0645\u0633\u062A\u0647\u0644\u0643 \u0644\u0627 \u064A\u064F\u0635\u0631\u0641 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0639\u0646\u062F \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629.");
    } catch (e) {
      if (live(ctx)) unavailable(e);
    }
  }
  async function resume() {
    if (!native() || !user() || !KEYS[platform()]) return;
    try {
      await client().resume();
    } catch (_) {
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  window.NativeShop = { renderGold, openGold, openVip, resume, close };
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
