---
title: xdty自动乐跑
createTime: 2025/07/13 21:23:14
permalink: /article/b65rfd47/
---

> 还没有进行测试与实际数据进行比较，有被发现风险，请谨慎使用

关于请求部分的分析[这篇文章](https://github.com/fulian23/LePaoReverse/)已经分析的很详尽了，但是没有详细分析轨迹文件内容，下面我们尝试对源码进行逆向分析

解包小程序得到`app-service.js`

我们找到上传跑步记录的地方：

```javascript
uploadRecord: function(t, e) {
    var r = this,
        i = (t.commit, t.dispatch),
        o = (t.state, t.getters),
        a = _(m(o.records).reverse(), 1)[0],
        s = e ? o.records.find((function(t) {
            return t._id == e
        })) : a;
    return new Promise(function() {
        var t = y(v().mark((function t(a, l) {
            var d, p, b, g, y, _, w, S;
            return v().wrap((function(t) {
                for (;;) switch (t.prev = t.next) {
                    case 0:
                        if (s) {
                            t.next = 4;
                            break
                        }
                        return n.hideLoading(), a(), t.abrupt("return");
                    case 4:
                        return t.next = 7, (0, u.createTxt)((0, f.Encrypt)(JSON.stringify(s.file)));
                    case 7:
                        return d = t.sent, t.next = 10, i("uploadFile", {
                            filePath: d
                        });
                    case 10:
                        if (p = t.sent) {
                            t.next = 15;
                            break
                        }
                        return a(null), n.hideLoading(), t.abrupt("return");
                    case 15:
                        if (s = x(x({}, s), {}, {
                                record_file: p.split("Public/Upload/file/")[1]
                            }), 0 == (b = (0, c.default)(s, (function(t, e) {
                                return ["term_id", "game_id", "start_time", "end_time", "log_data", "file_img", "is_running_area_valid", "mobileDeviceId", "mobileModel", "mobileOsVersion", "step_info", "step_num", "used_time", "distance", "record_img", "record_file"].includes(e)
                            }))).start_time ? (b.start_time = b.end_time - b.used_time, s.point_list[0] && b.start_time > parseInt(s.point_list[0].time) && (b.start_time = parseInt(s.point_list[0].time) - 180)) : 0 != b.start_time && s.point_list[0] && b.start_time > parseInt(s.point_list[0].time) && (b.start_time = parseInt(s.point_list[0].time) - 3), n.hideLoading(), "1" != s.type) {
                            t.next = 26;
                            break
                        }
                        return t.next = 23, (0, h.stopRunV278)(b);
                    case 23:
                        t.t0 = t.sent, t.next = 29;
                        break;
                    case 26:
                        return t.next = 28, (0, h.stopFreeRunV220)(b);
                    case 28:
                        t.t0 = t.sent;
                    case 29:
                        if (g = t.t0) {
                            t.next = 34;
                            break
                        }
                        return a({
                            _id: s._id
                        }), t.abrupt("return");
                    case 34:
                        if ("has" != g) {
                            t.next = 40;
                            break
                        }
                        return y = m(o.records), e ? y = y.filter((function(t) {
                            return (null == t ? void 0 : t._id) != e
                        })) : (y.pop(), r.$toast("上传成功")), i("setRecords", y), a("has"), t.abrupt("return");
                    case 40:
                        if (_ = m(o.records), e ? _ = _.filter((function(t) {
                                return (null == t ? void 0 : t._id) != e
                            })) : _.pop(), i("setRecords", _), a(g), null == g || !g.record_id) {
                            t.next = 52;
                            break
                        }
                        return t.next = 47, (0, u.createTxt)(s.gyr);
                    case 47:
                        return w = t.sent, t.next = 50, i("uploadGyr", {
                            filePath: w
                        });
                    case 50:
                        S = t.sent, (0, h.gyroscope)({
                            record_id: null == g ? void 0 : g.record_id,
                            gyroscope_file: S
                        });
                    case 52:
                    case "end":
                        return t.stop()
                }
            }), t)
        })));
        return function(e, r) {
            return t.apply(this, arguments)
        }
    }())
},
```

注意到case4，先将对象转化为字符串然后调用AES加密，最后调用`createTxt`，这应该就算轨迹文件了，那么文件加密前内容应该就是`s.file`，搜索`file:`可以找到有关轨迹文件内容生成的全部代码：

```javascript
"1a1e": function(t, e, r) {
    "use strict";
    (function(t, n) {
        Object.defineProperty(e, "__esModule", {
            value: !0
        }), e.default = void 0;
        var i = p(r("5a0c")),
            o = p(r("d772")),
            a = p(r("371c")),
            s = p(r("f560")),
            c = p(r("77c1")),
            u = r("ed08"),
            f = r("90c5"),
            l = r("09cb"),
            d = r("0e5c"),
            h = r("365c");

        function p(t) {
            return t && t.__esModule ? t : {
                default: t
            }
        }

        function b(t) {
            return (b = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(t) {
                return typeof t
            } : function(t) {
                return t && "function" == typeof Symbol && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t
            })(t)
        }

        function v() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */
            v = function() {
                return t
            };
            var t = {},
                e = Object.prototype,
                r = e.hasOwnProperty,
                n = Object.defineProperty || function(t, e, r) {
                    t[e] = r.value
                },
                i = "function" == typeof Symbol ? Symbol : {},
                o = i.iterator || "@@iterator",
                a = i.asyncIterator || "@@asyncIterator",
                s = i.toStringTag || "@@toStringTag";

            function c(t, e, r) {
                return Object.defineProperty(t, e, {
                    value: r,
                    enumerable: !0,
                    configurable: !0,
                    writable: !0
                }), t[e]
            }
            try {
                c({}, "")
            } catch (t) {
                c = function(t, e, r) {
                    return t[e] = r
                }
            }

            function u(t, e, r, i) {
                var o = e && e.prototype instanceof d ? e : d,
                    a = Object.create(o.prototype),
                    s = new O(i || []);
                return n(a, "_invoke", {
                    value: A(t, r, s)
                }), a
            }

            function f(t, e, r) {
                try {
                    return {
                        type: "normal",
                        arg: t.call(e, r)
                    }
                } catch (t) {
                    return {
                        type: "throw",
                        arg: t
                    }
                }
            }
            t.wrap = u;
            var l = {};

            function d() {}

            function h() {}

            function p() {}
            var g = {};
            c(g, o, (function() {
                return this
            }));
            var y = Object.getPrototypeOf,
                m = y && y(y(M([])));
            m && m !== e && r.call(m, o) && (g = m);
            var _ = p.prototype = d.prototype = Object.create(g);

            function w(t) {
                ["next", "throw", "return"].forEach((function(e) {
                    c(t, e, (function(t) {
                        return this._invoke(e, t)
                    }))
                }))
            }

            function S(t, e) {
                var i;
                n(this, "_invoke", {
                    value: function(n, o) {
                        function a() {
                            return new e((function(i, a) {
                                ! function n(i, o, a, s) {
                                    var c = f(t[i], t, o);
                                    if ("throw" !== c.type) {
                                        var u = c.arg,
                                            l = u.value;
                                        return l && "object" == b(l) && r.call(l, "__await") ? e.resolve(l.__await).then((function(t) {
                                            n("next", t, a, s)
                                        }), (function(t) {
                                            n("throw", t, a, s)
                                        })) : e.resolve(l).then((function(t) {
                                            u.value = t, a(u)
                                        }), (function(t) {
                                            return n("throw", t, a, s)
                                        }))
                                    }
                                    s(c.arg)
                                }(n, o, i, a)
                            }))
                        }
                        return i = i ? i.then(a, a) : a()
                    }
                })
            }

            function A(t, e, r) {
                var n = "suspendedStart";
                return function(i, o) {
                    if ("executing" === n) throw new Error("Generator is already running");
                    if ("completed" === n) {
                        if ("throw" === i) throw o;
                        return {
                            value: void 0,
                            done: !0
                        }
                    }
                    for (r.method = i, r.arg = o;;) {
                        var a = r.delegate;
                        if (a) {
                            var s = x(a, r);
                            if (s) {
                                if (s === l) continue;
                                return s
                            }
                        }
                        if ("next" === r.method) r.sent = r._sent = r.arg;
                        else if ("throw" === r.method) {
                            if ("suspendedStart" === n) throw n = "completed", r.arg;
                            r.dispatchException(r.arg)
                        } else "return" === r.method && r.abrupt("return", r.arg);
                        n = "executing";
                        var c = f(t, e, r);
                        if ("normal" === c.type) {
                            if (n = r.done ? "completed" : "suspendedYield", c.arg === l) continue;
                            return {
                                value: c.arg,
                                done: r.done
                            }
                        }
                        "throw" === c.type && (n = "completed", r.method = "throw", r.arg = c.arg)
                    }
                }
            }

            function x(t, e) {
                var r = e.method,
                    n = t.iterator[r];
                if (void 0 === n) return e.delegate = null, "throw" === r && t.iterator.return && (e.method = "return", e.arg = void 0, x(t, e), "throw" === e.method) || "return" !== r && (e.method = "throw", e.arg = new TypeError("The iterator does not provide a '" + r + "' method")), l;
                var i = f(n, t.iterator, e.arg);
                if ("throw" === i.type) return e.method = "throw", e.arg = i.arg, e.delegate = null, l;
                var o = i.arg;
                return o ? o.done ? (e[t.resultName] = o.value, e.next = t.nextLoc, "return" !== e.method && (e.method = "next", e.arg = void 0), e.delegate = null, l) : o : (e.method = "throw", e.arg = new TypeError("iterator result is not an object"), e.delegate = null, l)
            }

            function k(t) {
                var e = {
                    tryLoc: t[0]
                };
                1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e)
            }

            function E(t) {
                var e = t.completion || {};
                e.type = "normal", delete e.arg, t.completion = e
            }

            function O(t) {
                this.tryEntries = [{
                    tryLoc: "root"
                }], t.forEach(k, this), this.reset(!0)
            }

            function M(t) {
                if (t) {
                    var e = t[o];
                    if (e) return e.call(t);
                    if ("function" == typeof t.next) return t;
                    if (!isNaN(t.length)) {
                        var n = -1,
                            i = function e() {
                                for (; ++n < t.length;)
                                    if (r.call(t, n)) return e.value = t[n], e.done = !1, e;
                                return e.value = void 0, e.done = !0, e
                            };
                        return i.next = i
                    }
                }
                return {
                    next: j
                }
            }

            function j() {
                return {
                    value: void 0,
                    done: !0
                }
            }
            return h.prototype = p, n(_, "constructor", {
                value: p,
                configurable: !0
            }), n(p, "constructor", {
                value: h,
                configurable: !0
            }), h.displayName = c(p, s, "GeneratorFunction"), t.isGeneratorFunction = function(t) {
                var e = "function" == typeof t && t.constructor;
                return !!e && (e === h || "GeneratorFunction" === (e.displayName || e.name))
            }, t.mark = function(t) {
                return Object.setPrototypeOf ? Object.setPrototypeOf(t, p) : (t.__proto__ = p, c(t, s, "GeneratorFunction")), t.prototype = Object.create(_), t
            }, t.awrap = function(t) {
                return {
                    __await: t
                }
            }, w(S.prototype), c(S.prototype, a, (function() {
                return this
            })), t.AsyncIterator = S, t.async = function(e, r, n, i, o) {
                void 0 === o && (o = Promise);
                var a = new S(u(e, r, n, i), o);
                return t.isGeneratorFunction(r) ? a : a.next().then((function(t) {
                    return t.done ? t.value : a.next()
                }))
            }, w(_), c(_, s, "Generator"), c(_, o, (function() {
                return this
            })), c(_, "toString", (function() {
                return "[object Generator]"
            })), t.keys = function(t) {
                var e = Object(t),
                    r = [];
                for (var n in e) r.push(n);
                return r.reverse(),
                    function t() {
                        for (; r.length;) {
                            var n = r.pop();
                            if (n in e) return t.value = n, t.done = !1, t
                        }
                        return t.done = !0, t
                    }
            }, t.values = M, O.prototype = {
                constructor: O,
                reset: function(t) {
                    if (this.prev = 0, this.next = 0, this.sent = this._sent = void 0, this.done = !1, this.delegate = null, this.method = "next", this.arg = void 0, this.tryEntries.forEach(E), !t)
                        for (var e in this) "t" === e.charAt(0) && r.call(this, e) && !isNaN(+e.slice(1)) && (this[e] = void 0)
                },
                stop: function() {
                    this.done = !0;
                    var t = this.tryEntries[0].completion;
                    if ("throw" === t.type) throw t.arg;
                    return this.rval
                },
                dispatchException: function(t) {
                    if (this.done) throw t;
                    var e = this;

                    function n(r, n) {
                        return a.type = "throw", a.arg = t, e.next = r, n && (e.method = "next", e.arg = void 0), !!n
                    }
                    for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                        var o = this.tryEntries[i],
                            a = o.completion;
                        if ("root" === o.tryLoc) return n("end");
                        if (o.tryLoc <= this.prev) {
                            var s = r.call(o, "catchLoc"),
                                c = r.call(o, "finallyLoc");
                            if (s && c) {
                                if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
                                if (this.prev < o.finallyLoc) return n(o.finallyLoc)
                            } else if (s) {
                                if (this.prev < o.catchLoc) return n(o.catchLoc, !0)
                            } else {
                                if (!c) throw new Error("try statement without catch or finally");
                                if (this.prev < o.finallyLoc) return n(o.finallyLoc)
                            }
                        }
                    }
                },
                abrupt: function(t, e) {
                    for (var n = this.tryEntries.length - 1; n >= 0; --n) {
                        var i = this.tryEntries[n];
                        if (i.tryLoc <= this.prev && r.call(i, "finallyLoc") && this.prev < i.finallyLoc) {
                            var o = i;
                            break
                        }
                    }
                    o && ("break" === t || "continue" === t) && o.tryLoc <= e && e <= o.finallyLoc && (o = null);
                    var a = o ? o.completion : {};
                    return a.type = t, a.arg = e, o ? (this.method = "next", this.next = o.finallyLoc, l) : this.complete(a)
                },
                complete: function(t, e) {
                    if ("throw" === t.type) throw t.arg;
                    return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), l
                },
                finish: function(t) {
                    for (var e = this.tryEntries.length - 1; e >= 0; --e) {
                        var r = this.tryEntries[e];
                        if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), E(r), l
                    }
                },
                catch: function(t) {
                    for (var e = this.tryEntries.length - 1; e >= 0; --e) {
                        var r = this.tryEntries[e];
                        if (r.tryLoc === t) {
                            var n = r.completion;
                            if ("throw" === n.type) {
                                var i = n.arg;
                                E(r)
                            }
                            return i
                        }
                    }
                    throw new Error("illegal catch attempt")
                },
                delegateYield: function(t, e, r) {
                    return this.delegate = {
                        iterator: M(t),
                        resultName: e,
                        nextLoc: r
                    }, "next" === this.method && (this.arg = void 0), l
                }
            }, t
        }

        function g(t, e, r, n, i, o, a) {
            try {
                var s = t[o](a),
                    c = s.value
            } catch (t) {
                return void r(t)
            }
            s.done ? e(c) : Promise.resolve(c).then(n, i)
        }

        function y(t) {
            return function() {
                var e = this,
                    r = arguments;
                return new Promise((function(n, i) {
                    var o = t.apply(e, r);

                    function a(t) {
                        g(o, n, i, a, s, "next", t)
                    }

                    function s(t) {
                        g(o, n, i, a, s, "throw", t)
                    }
                    a(void 0)
                }))
            }
        }

        function m(t) {
            return function(t) {
                if (Array.isArray(t)) return S(t)
            }(t) || function(t) {
                if ("undefined" != typeof Symbol && null != t[Symbol.iterator] || null != t["@@iterator"]) return Array.from(t)
            }(t) || w(t) || function() {
                throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
            }()
        }

        function _(t, e) {
            return function(t) {
                if (Array.isArray(t)) return t
            }(t) || function(t, e) {
                var r = null == t ? null : "undefined" != typeof Symbol && t[Symbol.iterator] || t["@@iterator"];
                if (null != r) {
                    var n, i, o, a, s = [],
                        c = !0,
                        u = !1;
                    try {
                        if (o = (r = r.call(t)).next, 0 === e) {
                            if (Object(r) !== r) return;
                            c = !1
                        } else
                            for (; !(c = (n = o.call(r)).done) && (s.push(n.value), s.length !== e); c = !0);
                    } catch (t) {
                        u = !0, i = t
                    } finally {
                        try {
                            if (!c && null != r.return && (a = r.return(), Object(a) !== a)) return
                        } finally {
                            if (u) throw i
                        }
                    }
                    return s
                }
            }(t, e) || w(t, e) || function() {
                throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
            }()
        }

        function w(t, e) {
            if (t) {
                if ("string" == typeof t) return S(t, e);
                var r = Object.prototype.toString.call(t).slice(8, -1);
                return "Object" === r && t.constructor && (r = t.constructor.name), "Map" === r || "Set" === r ? Array.from(t) : "Arguments" === r || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r) ? S(t, e) : void 0
            }
        }

        function S(t, e) {
            (null == e || e > t.length) && (e = t.length);
            for (var r = 0, n = new Array(e); r < e; r++) n[r] = t[r];
            return n
        }

        function A(t, e) {
            var r = Object.keys(t);
            if (Object.getOwnPropertySymbols) {
                var n = Object.getOwnPropertySymbols(t);
                e && (n = n.filter((function(e) {
                    return Object.getOwnPropertyDescriptor(t, e).enumerable
                }))), r.push.apply(r, n)
            }
            return r
        }

        function x(t) {
            for (var e = 1; e < arguments.length; e++) {
                var r = null != arguments[e] ? arguments[e] : {};
                e % 2 ? A(Object(r), !0).forEach((function(e) {
                    k(t, e, r[e])
                })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : A(Object(r)).forEach((function(e) {
                    Object.defineProperty(t, e, Object.getOwnPropertyDescriptor(r, e))
                }))
            }
            return t
        }

        function k(t, e, r) {
            return (e = function(t) {
                var e = function(t, e) {
                    if ("object" !== b(t) || null === t) return t;
                    var r = t[Symbol.toPrimitive];
                    if (void 0 !== r) {
                        var n = r.call(t, e);
                        if ("object" !== b(n)) return n;
                        throw new TypeError("@@toPrimitive must return a primitive value.")
                    }
                    return String(t)
                }(t, "string");
                return "symbol" === b(e) ? e : String(e)
            }(e)) in t ? Object.defineProperty(t, e, {
                value: r,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : t[e] = r, t
        }
        i.default.extend(o.default);
        var E = t.getStorageSync("platform"),
            O = {
                step_info: [],
                config: {},
                cacheData: null,
                records: [],
                now: Date.now(),
                type: "1",
                startTime: "",
                endTime: "",
                time: 0,
                distance: 0,
                speed: 0,
                latitude: "",
                longitude: "",
                record_img: "",
                moveDis: 0,
                setting: {
                    showLocation: !0
                },
                points: [],
                scale: 16,
                clocks: [],
                gyr: [],
                btnState: "0",
                settings: {
                    voice: !1,
                    keepScreenOn: !1
                },
                allClocks: [],
                capture_config: {}
            },
            M = {
                mapInfo: x(x({}, O), JSON.parse(t.getStorageSync("mapInfo") || "{}"))
            },
            j = {
                step_info: function(t, e) {
                    return e.info.step_info || []
                },
                is_capture_zone: function(t, e) {
                    var r;
                    return null === (r = e.config) || void 0 === r ? void 0 : r.is_capture_zone
                },
                capture_config: function(t, e) {
                    var r;
                    return null === (r = e.config) || void 0 === r ? void 0 : r.capture_config
                },
                is_register_face: function(t, e) {
                    var r;
                    return null === (r = e.config) || void 0 === r ? void 0 : r.is_register_face
                },
                allClocks: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.allClocks) && void 0 !== r ? r : []
                },
                info: function(t) {
                    var e;
                    return null !== (e = t.mapInfo) && void 0 !== e ? e : {}
                },
                settings: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.settings) && void 0 !== r ? r : {}
                },
                cacheData: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.cacheData) && void 0 !== r ? r : null
                },
                isFirst: function(t, e) {
                    var r;
                    return !(null == e || null === (r = e.cacheData) || void 0 === r || !r.first)
                },
                type: function(t, e) {
                    return e.info.type
                },
                isFreeType: function(t, e) {
                    return 2 == e.type
                },
                startTime: function(t, e) {
                    return e.info.startTime
                },
                endTime: function(t, e) {
                    return e.info.endTime
                },
                config: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.config) && void 0 !== r ? r : {}
                },
                capture_type: function(t, e) {
                    var r;
                    return null === (r = e.config) || void 0 === r ? void 0 : r.capture_type
                },
                records: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.records) && void 0 !== r ? r : []
                },
                recordImg: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.info) || void 0 === n ? void 0 : n.record_img) && void 0 !== r ? r : ""
                },
                moveDis: function(t, e) {
                    var r;
                    return (null === (r = e.info) || void 0 === r ? void 0 : r.moveDis) || 0
                },
                now: function(t, e) {
                    var r = new Date((0, i.default)().format("YYYY/MM/DD")).getTime();
                    return (Date.now() - r) / 1e3
                },
                delayTimeStr: function(t, e) {
                    var r;
                    return (null === (r = e.config) || void 0 === r ? void 0 : r.delay_time_str) || ""
                },
                isLimitRange: function(t, e) {
                    var r;
                    return 1 == (null === (r = e.config) || void 0 === r ? void 0 : r.is_limit_range)
                },
                logLogic: function(t, e) {
                    var r;
                    return (null === (r = e.config) || void 0 === r ? void 0 : r.log_logic) || 1
                },
                isLimitRangePassNum: function(t, e) {
                    var r;
                    return (null === (r = e.config) || void 0 === r ? void 0 : r.pass_num) || 0
                },
                isLimitRangePassRate: function(t, e) {
                    var r;
                    return (null === (r = e.config) || void 0 === r ? void 0 : r.pass_rate) || 0
                },
                refreshClockCount: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.refresh_point_count) && void 0 !== r ? r : 0
                },
                logMode: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.log_mode) && void 0 !== r ? r : "3"
                },
                isDX: function(t, e) {
                    return "2" == e.logMode
                },
                runLineInfo: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.run_line_info) && void 0 !== r ? r : {}
                },
                logMaxDistance: function(t, e) {
                    var r;
                    return +(null === (r = e.runLineInfo) || void 0 === r ? void 0 : r.log_max_distance)
                },
                pointMaxDistance1: function(t, e) {
                    var r, n;
                    return null !== (r = +(null === (n = e.runLineInfo) || void 0 === n ? void 0 : n.point_max_distance1)) && void 0 !== r ? r : 0
                },
                pointMaxDistance2: function(t, e) {
                    var r, n;
                    return null !== (r = +(null === (n = e.runLineInfo) || void 0 === n ? void 0 : n.point_max_distance2)) && void 0 !== r ? r : 0
                },
                repeat_num: function(t, e) {
                    return e.config.repeat_num || 0
                },
                hasEventInfo: function(t, e) {
                    var r;
                    return null === (r = e.config) || void 0 === r ? void 0 : r.event_info
                },
                pointNum: function(t, e) {
                    var r;
                    return e.hasEventInfo ? 0 === Object.entries(e.area).length ? 0 : 1 * (e.config.point_num || 0) : +(null === (r = e.timeRule) || void 0 === r ? void 0 : r.min_log_num) || 0
                },
                clocksNum: function(e, r) {
                    return /ios/.test(E) && t.startLocationUpdateBackground({
                        success: function() {
                            t.removeStorageSync("gpsModal")
                        },
                        fail: function() {
                            t.setStorageSync("gpsModal", 1)
                        }
                    }), r.isDX ? r.pointNum * (1 * r.repeat_num + 1) : r.pointNum
                },
                isInLimitZone: function(t, e) {
                    return e.pointList.filter((function(t) {
                        return +t.calcDis <= +e.pointMaxDistance2
                    })).length >= e.pointNum
                },
                pointList: function(t, e) {
                    var r, n;
                    return (null !== (r = null === (n = e.runLineInfo) || void 0 === n ? void 0 : n.point_list) && void 0 !== r ? r : []).map((function(t) {
                        var r, n, i = _(null !== (r = null == t || null === (n = t.jingwei) || void 0 === n ? void 0 : n.split(",")) && void 0 !== r ? r : [], 2),
                            o = i[0],
                            a = void 0 === o ? 0 : o,
                            s = i[1],
                            c = void 0 === s ? 0 : s;
                        return x(x({}, t), {}, {
                            latitude: a,
                            longitude: c,
                            title: t.address,
                            calcDis: (0, l.calcDistance)(+e.latitude, +e.longitude, +a, +c, !0),
                            pass: !1
                        })
                    })).sort((function(t, e) {
                        return +t.index - +e.index
                    }))
                },
                pointOptions: function(t, e) {
                    var r = e.passClocks.map((function(t) {
                        return t.id
                    }));
                    return e.pointList.filter((function(t) {
                        return !r.includes(t.id)
                    }))
                },
                mustPointList: function(t, e) {
                    return e.pointOptions.filter((function(t) {
                        return 1 == (null == t ? void 0 : t.type)
                    }))
                },
                normalPointList: function(t, e) {
                    return e.pointOptions.filter((function(t) {
                        return 2 == (null == t ? void 0 : t.type)
                    }))
                },
                normalPointListDis1: function(t, e) {
                    return e.normalPointList.filter((function(t) {
                        return (null == t ? void 0 : t.calcDis) <= e.pointMaxDistance1
                    }))
                },
                normalPointListDis2: function(t, e) {
                    return e.normalPointList.filter((function(t) {
                        return (null == t ? void 0 : t.calcDis) <= e.pointMaxDistance2
                    }))
                },
                timeRuleArr: function(t, e) {
                    var r, n = new Date((0, i.default)().format("YYYY/MM/DD")).getTime();
                    return (null !== (r = e.config.time_rule_arr) && void 0 !== r ? r : []).map((function(t) {
                        return x(x({}, t), {}, {
                            start_time_txt: (0, i.default)(n + 1e3 * (null == t ? void 0 : t.start_time)).format("YYYY-MM-DD HH:mm"),
                            end_time_txt: (0, i.default)(n + 1e3 * (null == t ? void 0 : t.end_time)).format("YYYY-MM-DD HH:mm")
                        })
                    }))
                },
                timeRule: function(t, e) {
                    if (e.hasEventInfo) return x(x({}, e.config.event_info), {}, {
                        min_log_num: e.hasEventInfo ? e.pointNum : e.runLineInfo.point_num * (1 * e.repeat_num + 1),
                        pace_str: 0 == e.config.pace_str ? 0 : e.config.pace_str
                    });
                    var r, n = _(e.timeRuleArr.filter((function(t) {
                            return +t.start_time <= e.now && e.now <= +t.end_time
                        })), 1)[0],
                        i = void 0 === n ? null : n;
                    return 1 === e.is_capture_zone && 2 == e.capture_type && (x(x({}, i), {}, {
                        min_log_num: null === (r = e.config) || void 0 === r ? void 0 : r.point_num
                    }), function(t) {
                        throw new TypeError('"resRule" is read-only')
                    }()), i
                },
                minDistance: function(t, e) {
                    var r, n;
                    return +(null !== (r = null === (n = e.timeRule) || void 0 === n ? void 0 : n.min_distance) && void 0 !== r ? r : 0)
                },
                beforePass: function(t, e) {
                    return 1e3 * e.distance > 200
                },
                passRules: function(t, e) {
                    if (!e.timeRule && !e.hasEventInfo) return [];
                    var n = e.isDX ? e.clocksNum : e.pointNum,
                        i = e.distance < .2 ? "距离过短，此次记录将不会保存" : "本次跑步距离不达标,将不会关联成绩，确定结束吗?";
                    return [{
                        key: "min_distance",
                        des: "里程：≥$公里",
                        type: "Number",
                        validateModal: function(t) {
                            return {
                                content: e.distance < t && i
                            }
                        }
                    }, {
                        key: "min_log_num",
                        des: "打卡：".concat(n, "次"),
                        type: "Number",
                        validateModal: function(t) {
                            return {
                                content: e.passClocks.length < n && "本次跑步打卡次数不够，将不会关联成绩，确定结束吗"
                            }
                        }
                    }, {
                        key: "pace_str",
                        des: "配速：$分钟/公里 ",
                        type: "String",
                        validateModal: function(t) {
                            var r, n = _(null == t ? void 0 : t.split("~"), 2),
                                i = n[0],
                                o = void 0 === i ? 0 : i,
                                a = n[1],
                                s = void 0 === a ? 0 : a;
                            return {
                                content: null === (r = [{
                                    content: "本次跑步速度过慢，将不会关联成绩，确定结束吗？",
                                    pass: (0, l.transformPace)(e.avgPace) > s
                                }, {
                                    content: "本次跑步速度过快，将不会关联成绩，确定结束吗？",
                                    pass: (0, l.transformPace)(e.avgPace) < o
                                }].find((function(t) {
                                    return t.pass
                                }))) || void 0 === r ? void 0 : r.content
                            }
                        }
                    }].map((function(t) {
                        var n, i, o, a;
                        return x(x({}, t), {}, {
                            icon: r("e962")("./icon-".concat(t.key, ".png")),
                            des: t.des.replace("$", null !== (n = null === (i = e.timeRule) || void 0 === i ? void 0 : i[t.key]) && void 0 !== n ? n : "-"),
                            value: "Number" == t.type ? +(null === (o = e.timeRule) || void 0 === o ? void 0 : o[t.key]) : null === (a = e.timeRule) || void 0 === a ? void 0 : a[t.key]
                        })
                    })).filter((function(t) {
                        return !!t.value
                    })).map((function(t) {
                        return x(x({}, t), {}, {
                            content: t.validateModal(t.value).content
                        })
                    }))
                },
                areaCode: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.run_zone_id) && void 0 !== r ? r : ""
                },
                areaName: function(t, e) {
                    var r, n;
                    return null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.run_zone_name) && void 0 !== r ? r : ""
                },
                inOfflineArea: function(t, e) {
                    var r;
                    return 1 == (null === (r = e.config) || void 0 === r ? void 0 : r.offline_gameList_status)
                },
                areas: function(t, e) {
                    var r, n, i = (null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.run_zone_list) && void 0 !== r ? r : []).map((function(t) {
                        return x(x({}, t), {}, {
                            label: t.name,
                            value: t.id
                        })
                    }));
                    return null != e && e.inOfflineArea ? i.filter((function(t) {
                        return 2 == (null == t ? void 0 : t.point_type)
                    })) : i
                },
                area: function(t, e) {
                    var r;
                    return null !== (r = e.areas.find((function(t) {
                        return (null == t ? void 0 : t.value) == e.areaCode
                    }))) && void 0 !== r ? r : {}
                },
                isHh: function(t, e) {
                    return 4 == e.point_type
                },
                isOffLine: function(t, e) {
                    return 2 == e.point_type
                },
                point_type: function(t, e) {
                    return e.config.point_type
                },
                latitude: function(t, e) {
                    return e.info.latitude
                },
                longitude: function(t, e) {
                    return e.info.longitude
                },
                scale: function(t, e) {
                    var r;
                    return null !== (r = e.info.scale) && void 0 !== r ? r : 16
                },
                time: function(t, e) {
                    var r;
                    return null !== (r = e.info.time) && void 0 !== r ? r : 0
                },
                gyr: function(t, e) {
                    return e.info.gyr || []
                },
                distance: function(t, e) {
                    return e.info.distance < 10 ? "0.0" : parseFloat((e.info.distance / 1e3).toFixed(2))
                },
                clocks: function(t, e) {
                    var r, n = null !== (r = e.info.clocks) && void 0 !== r ? r : [],
                        i = e.config.random_distance,
                        o = void 0 === i ? 100 : i;
                    return n.forEach((function(t, r) {
                        var n = Math.floor(Math.random() * (o - 50)) + 50;
                        t.dis || (t.dis = 1e3 * e.distance + n), t.disFrom = (0, l.calcDistance)(t.latitude, t.longitude, e.point.latitude, e.point.longitude)
                    })), n
                },
                passClocks: function(t, e) {
                    return e.clocks.filter((function(t) {
                        return t.pass
                    }))
                },
                setting: function(t, e) {
                    var r;
                    return null !== (r = e.info.setting) && void 0 !== r ? r : {}
                },
                points: function(t, e) {
                    var r;
                    return null !== (r = e.info.points) && void 0 !== r ? r : []
                },
                point: function(t, e) {
                    var r, n, i, o = _(null !== (r = null == e || null === (n = e.points) || void 0 === n ? void 0 : n[(null == e || null === (i = e.points) || void 0 === i ? void 0 : i.length) - 1]) && void 0 !== r ? r : [], 3),
                        a = o[0],
                        s = void 0 === a ? e.latitude : a,
                        c = o[1],
                        u = void 0 === c ? e.longitude : c,
                        f = o[2];
                    return {
                        latitude: s,
                        longitude: u,
                        speed: void 0 === f ? 0 : f
                    }
                },
                btnState: function(t, e) {
                    var r;
                    return null !== (r = e.info.btnState) && void 0 !== r ? r : "0"
                },
                isStart: function(t, e) {
                    return +e.btnState > 1
                },
                isRuning: function(t, e) {
                    return 2 == +e.btnState
                },
                isPause: function(t, e) {
                    return 3 == +e.btnState
                },
                runZoneLatlngs: function(t, e) {
                    var r, n, i = null !== (r = null === (n = e.config) || void 0 === n ? void 0 : n.run_zone_latlng) && void 0 !== r ? r : [];
                    return i.length < 3 ? [] : i.map((function(t) {
                        var e = _(t.split(","), 2);
                        return {
                            longitude: +e[0],
                            latitude: +e[1]
                        }
                    }))
                },
                is_limit_range: function(t, e) {
                    var r;
                    return 1 == (null === (r = e.config) || void 0 === r ? void 0 : r.is_limit_range)
                },
                run_zone_latlng_invalid: function(t, e) {
                    var r = e.config.run_zone_latlng_invalid;
                    return (void 0 === r ? [] : r).map((function(t) {
                        return {
                            latitude: t.split(",")[1],
                            longitude: t.split(",")[0]
                        }
                    })) || []
                },
                polygons: function(t, e) {
                    return (e.is_limit_range ? [e.runZoneLatlngs.length ? {
                        points: e.runZoneLatlngs,
                        strokeWidth: 1,
                        strokeColor: "#18C183",
                        fillColor: "#18c1831a",
                        level: "abovebuildings"
                    } : null, e.run_zone_latlng_invalid.length ? {
                        points: e.run_zone_latlng_invalid,
                        strokeWidth: 1,
                        strokeColor: "#18C183",
                        fillColor: "#ffffff",
                        level: "abovebuildings"
                    } : null] : [e.runZoneLatlngs.length ? {
                        points: e.runZoneLatlngs,
                        strokeWidth: 1,
                        strokeColor: "#18C183",
                        fillColor: "#18c1831a",
                        level: "abovebuildings"
                    } : null]).filter((function(t) {
                        return t
                    }))
                },
                isInZone: function(t, e) {
                    return function() {
                        var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : e.point.longitude,
                            r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : e.point.latitude;
                        return t && r && (0, l.isInsidePolygon)(+t, +r, e.runZoneLatlngs, e.is_limit_range ? e.run_zone_latlng_invalid : [])
                    }
                },
                markers: function(t, e) {
                    return e.clocks.map((function(t, r) {
                        return 1 == e.is_capture_zone && 2 == e.capture_type ? {
                            id: r,
                            latitude: +t.latitude,
                            longitude: +t.longitude,
                            title: t.title,
                            iconPath: t.pass ? "/static/wg2.png" : "/static/wg1.png",
                            width: 25,
                            height: 27
                        } : {
                            id: r,
                            latitude: +t.latitude,
                            longitude: +t.longitude,
                            title: t.title,
                            iconPath: t.pass ? "/static/icon-location-pass.png" : "/static/icon-location.png",
                            width: 25,
                            height: 27
                        }
                    }))
                },
                polyline: function(t, e) {
                    var r = e.fullPoints;
                    return (0, l.makePolyline)(r)
                },
                sortPoints: function(t, e) {
                    return e.points.map((function(t) {
                        var e = _(t, 3);
                        return e[0], e[1], e[2]
                    })).sort((function(t, e) {
                        return t - e
                    }))
                },
                minSpeed: function(t, e) {
                    return e.sortPoints[0]
                },
                maxSpeed: function(t, e) {
                    return e.sortPoints[e.sortPoints.length - 1]
                },
                avgSpeedMS: function(t, e) {
                    return e.distance && e.time ? (1e3 * e.distance / e.time).toFixed(2) : 0
                },
                avgSpeed: function(t, e) {
                    return e.distance && e.time ? (e.distance / i.default.duration(e.time, "s").asHours()).toFixed(2) : 0
                },
                curSpeed: function(t, e) {
                    var r, n;
                    return null !== (r = null == e || null === (n = e.point) || void 0 === n ? void 0 : n.speed) && void 0 !== r ? r : 0
                },
                curPace: function(t, e) {
                    return (0, l.calcPace)(e.curSpeed)
                },
                avgPace: function(t, e) {
                    return (0, l.calcPace)(e.avgSpeed, !1)
                },
                fullPoints: function(t, e) {
                    return e.points.map((function(t) {
                        var e = _(t, 9),
                            r = e[0],
                            n = e[1],
                            i = e[2],
                            o = e[3],
                            a = e[4],
                            s = e[5],
                            u = e[6],
                            f = e[7],
                            l = e[8];
                        return (0, c.default)({
                            a: r,
                            o: n,
                            s: i,
                            p: o,
                            b: a,
                            c: s,
                            d: u,
                            e: f,
                            l: l
                        }, (function(t) {
                            return t && !!"".concat(t).length
                        }))
                    }))
                },
                isRunningAreaValid: function(t, e) {
                    var r, n = e.fullPoints.map((function(t) {
                            return x(x({}, t), {}, {
                                isInZone: e.isInZone(t.o, t.a)
                            })
                        })).filter((function(t) {
                            return t.isInZone
                        })),
                        i = e.fullPoints.filter((function(t) {
                            return 1 != t.l
                        })),
                        o = {
                            1: function() {
                                return 1
                            },
                            2: function() {
                                return n.length >= e.isLimitRangePassNum
                            },
                            3: function() {
                                return i.length / e.fullPoints.length >= e.isLimitRangePassRate
                            }
                        };
                    return !(null == o || null === (r = o[e.logLogic]) || void 0 === r || !r.call(o))
                },
                record: function(t, e) {
                    var r, i = m(e.clocks).map((function(t) {
                            var e;
                            return x(x({}, t), null !== (e = null == t ? void 0 : t.query_data) && void 0 !== e ? e : {})
                        })).filter((function(t) {
                            return t.pass
                        })).sort((function(t, e) {
                            return t.time - e.time
                        })).map((function(t) {
                            return (0, c.default)(t, (function(t, e) {
                                return ["distance", "latitude", "longitude", "point_id", "time"].includes(e)
                            }))
                        })).map((function(t) {
                            return x(x({}, t), {}, {
                                longtitude: t.longitude,
                                time: parseInt(t.time) || ""
                            })
                        })),
                        o = e.isOffLine ? e.allClocks : e.clocks,
                        a = [];
                    o.forEach((function(t) {
                        var r = i.find((function(e) {
                            return t.id == e.point_id
                        }));
                        r ? 1 == e.is_capture_zone && 2 == e.capture_type ? a.push(x(x({}, r), {}, {
                            time: t.clocktime
                        })) : a.push(x({}, r)) : a.push({
                            point_id: t.id
                        })
                    })), i = a;
                    var s = (0, l.groupPoints)(e.fullPoints).reduce((function(t, e, r, n) {
                        var i;
                        return r == n.length - 1 && null !== (i = e[0]) && void 0 !== i && i.p ? m(t) : [].concat(m(t), m(e))
                    }), []);
                    i.forEach((function(t) {
                        t && delete t.distance
                    }));
                    var u = n.getDeviceInfo().model;
                    return {
                        _id: Date.now(),
                        beforePass: e.beforePass,
                        type: e.type,
                        showType: e.type,
                        game_id: e.areaCode,
                        time: e.time,
                        start_time: parseInt(e.startTime / 1e3),
                        end_time: parseInt(e.endTime / 1e3),
                        distance: e.distance,
                        log_num: i.length,
                        file: s,
                        run_zone_name: null === (r = e.area) || void 0 === r ? void 0 : r.label,
                        point_list: i,
                        record_img: e.recordImg,
                        log_mode: e.logMode,
                        point_type_str: {
                            1: "自由打卡",
                            2: "定向打卡"
                        }[e.logMode],
                        term_id: 1,
                        log_data: i.length <= 0 ? "" : JSON.stringify(i),
                        file_img: "",
                        is_running_area_valid: e.isRunningAreaValid ? 1 : 0,
                        mobileDeviceId: 1,
                        mobileModel: u || 1,
                        mobileOsVersion: 1,
                        step_info: JSON.stringify({
                            interval: 60,
                            list: e.step_info
                        }),
                        step_num: e.step_info.length ? e.step_info.reduce((function(t, e) {
                            return t + e
                        }), 0) : 1,
                        used_time: e.time,
                        gyr: e.gyr
                    }
                }
            },
            P = {
                setInfo: function(e, r) {
                    r ? (e.mapInfo = x(x({}, e.mapInfo), r), t.setStorageSync("mapInfo", JSON.stringify(e.mapInfo))) : (e.mapInfo = x({}, O), n.removeStorageSync("mapInfo"))
                }
            },
            C = {
                setSettings: function(t, e) {
                    (0, t.commit)("setInfo", {
                        settings: x(x({}, t.getters.settings), e)
                    })
                },
                setMap: function(t, e) {
                    (0, t.commit)("setInfo", e)
                },
                setRecordImg: function(t, e) {
                    (0, t.commit)("setInfo", {
                        record_img: e
                    })
                },
                setType: function(t, e) {
                    (0, t.commit)("setInfo", {
                        type: e
                    })
                },
                setRunTimestamp: function(t, e) {
                    var r = t.commit,
                        n = t.getters;
                    r("setInfo", k({
                        startTime: n.startTime,
                        endTime: n.endTime
                    }, e, Date.now()))
                },
                setMapConfig: function(t, e) {
                    (0, t.commit)("setInfo", {
                        config: (t.state, x({}, e))
                    })
                },
                setCacheData: function(t, e) {
                    (0, t.commit)("setInfo", {
                        cacheData: x(x({}, t.state.mapInfo.cacheData), e)
                    })
                },
                setNowTime: function(t) {
                    (0, t.commit)("setInfo", {
                        now: Date.now()
                    })
                },
                setRecords: function(t) {
                    var e = t.commit,
                        r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [];
                    e("setInfo", {
                        records: r
                    })
                },
                setClocks: function(t, e) {
                    return y(v().mark((function r() {
                        var i, o, a, c, u, f, l, d, h, p;
                        return v().wrap((function(r) {
                            for (;;) switch (r.prev = r.next) {
                                case 0:
                                    if (i = t.commit, t.state, (o = t.getters).isDX && e && (c = e.length ? e[0].dis : ""), o.isHh && (u = o.timeRule, u.point_num_offline, u.point_num_online), (l = (f = function(t) {
                                            var r = o.mustPointList,
                                                n = [].concat(m((0, s.default)(r).filter((function(t, e) {
                                                    return e < o.pointNum
                                                }))), m((0, s.default)(t).filter((function(t, e) {
                                                    return e < o.pointNum - r.length
                                                }))));
                                            return (o.isHh || o.isOffLine || 1 == o.is_capture_zone && 2 == o.capture_type) && (a = n), o.isDX && (n = n.filter((function(t, e) {
                                                return e <= 0
                                            })), o.isStart && (n = [].concat(m(o.clocks), m(n))), e && n.length && (n[0].dis = c)), n
                                        })(o.normalPointListDis1)).length < o.pointNum && (l = f(o.normalPointListDis2)), o.isFreeType && (l = []), i("setInfo", {
                                            clocks: []
                                        }), o.isHh || o.isOffLine || 1 == o.is_capture_zone && 2 == o.capture_type) {
                                        if (d = [], o.repeat_num) {
                                            for (p = 1; p <= o.repeat_num; p++) d.push.apply(d, m(JSON.parse(JSON.stringify(a))));
                                            (h = a).push.apply(h, d)
                                        }
                                        i("setInfo", {
                                            allClocks: a
                                        }), i("setInfo", {
                                            clocks: a.slice(0, l.length)
                                        })
                                    } else i("setInfo", {
                                        clocks: l
                                    });
                                    0 == o.pointNum && o.isDX && !o.isFreeType && n.showToast({
                                        icon: "none",
                                        title: "请配置定向打卡点数量",
                                        duration: 2500
                                    });
                                case 10:
                                case "end":
                                    return r.stop()
                            }
                        }), r)
                    })))()
                },
                clearClocks: function(t) {
                    (0, t.commit)("setInfo", {
                        clocks: []
                    })
                },
                setClocksState: function(t, e) {
                    return y(v().mark((function r() {
                        var i, o, a, s, c;
                        return v().wrap((function(r) {
                            for (;;) switch (r.prev = r.next) {
                                case 0:
                                    if (i = t.commit, o = t.dispatch, t.state, a = t.getters, !e.clocktime) {
                                        r.next = 9;
                                        break
                                    }
                                    return (s = a.clocks)[e.i].clocktime = e.clocktime, i("setInfo", {
                                        clocks: m(s)
                                    }), r.abrupt("return");
                                case 9:
                                    if (!e.dktime) {
                                        r.next = 14;
                                        break
                                    }
                                    return (s = a.clocks)[e.i].dktime = e.dktime, i("setInfo", {
                                        clocks: m(s)
                                    }), r.abrupt("return");
                                case 14:
                                    n.vibrateLong(), s = m(a.clocks).map((function(t, r) {
                                        return x(x({}, t), (a.isDX && a.isOffLine ? e.id == (null == t ? void 0 : t.id) && r == e.writeIndex : e.id == (null == t ? void 0 : t.id)) ? {
                                            pass: !0,
                                            query_data: e.query_data
                                        } : {})
                                    })), (0, u.playAudio)("https://data.lptiyu.com/Public/Static/wp_assets/assets/audio/succ.mp3"), i("setInfo", {
                                        clocks: s
                                    }), a.isDX && a.clocks.length < e.clocksNum && (a.isOffLine || 1 == a.is_capture_zone && 2 == a.capture_type ? (c = a.clocks.length) && a.clocks[c - 1].pass && i("setInfo", {
                                        clocks: [].concat(m(a.clocks), m(a.allClocks.slice(a.clocks.length, a.clocks.length + 1)))
                                    }) : o("setClocks"));
                                case 19:
                                case "end":
                                    return r.stop()
                            }
                        }), r)
                    })))()
                },
                setBtnState: function(t, e) {
                    var r = t.commit;
                    t.state, r("setInfo", {
                        btnState: e
                    })
                },
                setLocation: function(e, r) {
                    var n = e.commit,
                        i = e.dispatch,
                        o = (e.state, e.getters),
                        a = r.latitude,
                        s = r.longitude,
                        c = r.speed,
                        u = r.isOut,
                        f = void 0 !== u && u,
                        d = r.desc,
                        h = r.status,
                        p = r.dis,
                        b = void 0 === p ? 0 : p,
                        v = r.lose;
                    n("setInfo", {
                        moveDis: b
                    });
                    var g = t.getStorageSync("100Distance") || 0,
                        y = t.getStorageSync("time100") ? o.time - t.getStorageSync("time100") : o.time,
                        _ = 0;
                    if ((g += b) >= 100) {
                        for (_ = (0, l.calcPace)(g / y); g >= 100;) g -= 100;
                        t.setStorageSync("time100", o.time)
                    }
                    t.setStorageSync("100Distance", g), n("setInfo", x(f ? {
                        latitude: a,
                        longitude: s
                    } : {}, {
                        speed: c,
                        points: o.isStart ? [].concat(m(o.points), [
                            [a, s, c, o.isPause ? 1 : null, parseInt(o.distance), _, d, null, v ? 1 : null]
                        ]) : []
                    })), h && !o.isPause && i("setDistance")
                },
                setDistance: function(t) {
                    var e = t.commit,
                        r = (t.state, t.getters);
                    e("setInfo", {
                        distance: r.points.length <= 1 ? 0 : r.info.distance + r.moveDis
                    })
                },
                setTime: function(t) {
                    (0, t.commit)("setInfo", {
                        time: (t.state, t.getters).time + 1
                    })
                },
                uploadGyr: function(t, e) {
                    t.commit;
                    var r = e.filePath,
                        n = e.key,
                        i = void 0 === n ? "file" : n;
                    return new Promise(function() {
                        var t = y(v().mark((function t(e, n) {
                            var o, s, c, u, f;
                            return v().wrap((function(t) {
                                for (;;) switch (t.prev = t.next) {
                                    case 0:
                                        return t.next = 2, (0, d.uploadToOSS)(r, "Public/Upload/".concat(i, "/run_gyroscope/").concat("".concat(Date.now()).slice(-3)), !0);
                                    case 2:
                                        o = t.sent, s = _(o, 2), c = s[0], u = s[1], f = void 0 === u ? "" : u, c ? (a.default.info("".concat(c)), e(null)) : e(f);
                                    case 8:
                                    case "end":
                                        return t.stop()
                                }
                            }), t)
                        })));
                        return function(e, r) {
                            return t.apply(this, arguments)
                        }
                    }())
                },
                uploadFile: function(t, e) {
                    t.commit;
                    var r = e.filePath,
                        n = e.key,
                        i = void 0 === n ? "file" : n;
                    return new Promise(function() {
                        var t = y(v().mark((function t(e, n) {
                            var o, a, s, c, u;
                            return v().wrap((function(t) {
                                for (;;) switch (t.prev = t.next) {
                                    case 0:
                                        return t.next = 2, (0, d.uploadToOSS)(r, "Public/Upload/".concat(i, "/run_record/").concat("".concat(Date.now()).slice(-3)), !0);
                                    case 2:
                                        o = t.sent, a = _(o, 2), s = a[0], c = a[1], u = void 0 === c ? "" : c, e(s ? null : u);
                                    case 9:
                                    case "end":
                                        return t.stop()
                                }
                            }), t)
                        })));
                        return function(e, r) {
                            return t.apply(this, arguments)
                        }
                    }())
                },
                uploadRecord: function(t, e) {
                    var r = this,
                        i = (t.commit, t.dispatch),
                        o = (t.state, t.getters),
                        a = _(m(o.records).reverse(), 1)[0],
                        s = e ? o.records.find((function(t) {
                            return t._id == e
                        })) : a;
                    return new Promise(function() {
                        var t = y(v().mark((function t(a, l) {
                            var d, p, b, g, y, _, w, S;
                            return v().wrap((function(t) {
                                for (;;) switch (t.prev = t.next) {
                                    case 0:
                                        if (s) {
                                            t.next = 4;
                                            break
                                        }
                                        return n.hideLoading(), a(), t.abrupt("return");
                                    case 4:
                                        return t.next = 7, (0, u.createTxt)((0, f.Encrypt)(JSON.stringify(s.file)));
                                    case 7:
                                        return d = t.sent, t.next = 10, i("uploadFile", {
                                            filePath: d
                                        });
                                    case 10:
                                        if (p = t.sent) {
                                            t.next = 15;
                                            break
                                        }
                                        return a(null), n.hideLoading(), t.abrupt("return");
                                    case 15:
                                        if (s = x(x({}, s), {}, {
                                                record_file: p.split("Public/Upload/file/")[1]
                                            }), 0 == (b = (0, c.default)(s, (function(t, e) {
                                                return ["term_id", "game_id", "start_time", "end_time", "log_data", "file_img", "is_running_area_valid", "mobileDeviceId", "mobileModel", "mobileOsVersion", "step_info", "step_num", "used_time", "distance", "record_img", "record_file"].includes(e)
                                            }))).start_time ? (b.start_time = b.end_time - b.used_time, s.point_list[0] && b.start_time > parseInt(s.point_list[0].time) && (b.start_time = parseInt(s.point_list[0].time) - 180)) : 0 != b.start_time && s.point_list[0] && b.start_time > parseInt(s.point_list[0].time) && (b.start_time = parseInt(s.point_list[0].time) - 3), n.hideLoading(), "1" != s.type) {
                                            t.next = 26;
                                            break
                                        }
                                        return t.next = 23, (0, h.stopRunV278)(b);
                                    case 23:
                                        t.t0 = t.sent, t.next = 29;
                                        break;
                                    case 26:
                                        return t.next = 28, (0, h.stopFreeRunV220)(b);
                                    case 28:
                                        t.t0 = t.sent;
                                    case 29:
                                        if (g = t.t0) {
                                            t.next = 34;
                                            break
                                        }
                                        return a({
                                            _id: s._id
                                        }), t.abrupt("return");
                                    case 34:
                                        if ("has" != g) {
                                            t.next = 40;
                                            break
                                        }
                                        return y = m(o.records), e ? y = y.filter((function(t) {
                                            return (null == t ? void 0 : t._id) != e
                                        })) : (y.pop(), r.$toast("上传成功")), i("setRecords", y), a("has"), t.abrupt("return");
                                    case 40:
                                        if (_ = m(o.records), e ? _ = _.filter((function(t) {
                                                return (null == t ? void 0 : t._id) != e
                                            })) : _.pop(), i("setRecords", _), a(g), null == g || !g.record_id) {
                                            t.next = 52;
                                            break
                                        }
                                        return t.next = 47, (0, u.createTxt)(s.gyr);
                                    case 47:
                                        return w = t.sent, t.next = 50, i("uploadGyr", {
                                            filePath: w
                                        });
                                    case 50:
                                        S = t.sent, (0, h.gyroscope)({
                                            record_id: null == g ? void 0 : g.record_id,
                                            gyroscope_file: S
                                        });
                                    case 52:
                                    case "end":
                                        return t.stop()
                                }
                            }), t)
                        })));
                        return function(e, r) {
                            return t.apply(this, arguments)
                        }
                    }())
                },
                setStop: function(t) {
                    var e = t.commit,
                        r = (t.state, t.getters);
                    return new Promise((function(t, n) {
                        var i, o, a = "",
                            s = m(r.records);
                        r.beforePass && (s = [].concat(m(s), [r.record]), a = null !== (i = null === (o = r.record) || void 0 === o ? void 0 : o._id) && void 0 !== i ? i : "");
                        var c = x(x(x({}, O), r.point), {}, {
                            config: r.config,
                            btnState: r.btnState,
                            records: s
                        });
                        e("setInfo", r.isFreeType ? x(x({}, c), {}, {
                            type: r.type
                        }) : c), t(a)
                    }))
                }
            };
        e.default = {
            namespaced: !0,
            state: M,
            getters: j,
            mutations: P,
            actions: C
        }
    }).call(this, r("bc2e").default, r("543d").default)
},
```



丢给ai，可以得知文件内容为`json`数组，每个`json`的结构如下：

- **`a` **: 纬度 (latitude) - `a` 变量对应 `r.latitude`
- **`o` **: 经度 (longitude) - `s` 变量对应 `r.longitude`
- **`s` **: 速度 (speed) - `c` 变量对应 `r.speed`
- **`p` **: 暂停标记 - `o.isPause ? 1 : null`
- **`b` **: 距离 - `parseInt(o.distance)` 当前总距离（整数，米）
- **`c` **: 配速 - `_` 变量，从代码看是 `(0, l.calcPace)(g / y)` 计算的配速
- **`d` **: 描述信息 - `d` 变量对应 `r.desc`
- **`e` **: 固定为 `null` - 可能预留字段
- **`l` **: 信号丢失标记 - `v ? 1 : null`，`v` 对应 `r.lose`





那么我们现在可以编写自动乐跑脚本了：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import time
import math
import random
import json
import base64
import hashlib
import hmac
import requests
from datetime import datetime, timedelta, timezone
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

# ========== 全局配置 ==========
DEBUG               = False      # True: 不发请求,仅打印; False: 真实上传并调用API

# 跑步参数 (自定义)
DISTANCE_KM         = 2.01       # 目标总跑步里程 (公里)
PACE_MIN_PER_KM     = random.uniform(5.0, 7.0)       # 目标配速 (分钟/公里)


TARGET_RUN_ZONE_ID  = "10"      # "10" 对应 "翔安校区（二期田径场）"

# 跑区围栏 (用于生成椭圆轨迹)
# 注意：如果API返回了跑区范围，下面的配置将被覆盖
RUN_ZONE_COORDS     = [
    "118.3031661057739,24.610242703672824",
    "118.30222196820066,24.610281720653045",
    "118.30209322216794,24.608545453253893",
    "118.30318756344602,24.608584470763535"
]
NOISE_FACTOR_METERS = 2.0       # GPS轨迹噪声幅度(米), 0为完美椭圆

# 模拟参数
LOG_DATA_POINTS     = 10         # 模拟打卡点数量

# 用户信息 & 加密配置
UID                 = 0          # 用户ID，可在小程序个人信息中找到
TOKEN               = ""         # 浏览器打开https://xdty.xmu.edu.cn/bdlp_h5_fitness_test/public/index.php/index/login/xmLogin登录，之后在url中寻找token
SCHOOL_ID           = 788        # 学校ID，厦门大学为788
STUDENT_NUM         = ""         # 学号
CARD_ID             = STUDENT_NUM



# =============================================


SECRET_KEY          = "rDJiNB9j7vD2"
AES_KEY             = b"Wet2C8d34f62ndi3"
AES_IV              = b"K6iv85jBD8jgf32D"
# OSS & API
BASE_URL            = "https://xdty.xmu.edu.cn"
OSS_DIR_PREFIX      = "Public/Upload/file/run_record"
MOBILE_MODEL        = "SM-E5260"


def calculate_ellipse_params(coords_str_list):
    points = [tuple(map(float, c.split(','))) for c in coords_str_list]
    lons, lats = [p[0] for p in points], [p[1] for p in points]
    lon_c, lat_c = sum(lons) / len(lons), sum(lats) / len(lats)
    r_lon, r_lat = (max(lons) - min(lons)) / 2, (max(lats) - min(lats)) / 2
    a, b = r_lon * 111320 * math.cos(math.radians(lat_c)), r_lat * 111000
    h = ((a - b) ** 2) / ((a + b) ** 2)
    circumference_m = math.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))
    if DEBUG: print(f"椭圆参数: 中心=({lon_c:.6f}, {lat_c:.6f}), 周长≈{circumference_m:.2f}米")
    return lon_c, lat_c, r_lon, r_lat, circumference_m

def add_gps_noise(lat, lon, meters):
    if meters <= 0: return lat, lon
    r, d = 6371000, random.uniform(0, meters)
    lat, lon, bearing = map(math.radians, [lat, lon, random.uniform(0, 360)])
    new_lat = math.asin(math.sin(lat) * math.cos(d / r) + math.cos(lat) * math.sin(d / r) * math.cos(bearing))
    new_lon = lon + math.atan2(math.sin(bearing) * math.sin(d / r) * math.cos(lat), math.cos(d / r) - math.sin(lat) * math.sin(new_lat))
    return math.degrees(new_lat), math.degrees(new_lon)

def generate_realistic_speed_profile(total_time_sec, avg_speed_mps):
    speed_profile = []
    current_speed = avg_speed_mps * 0.7
    target_speed = avg_speed_mps
    warmup_duration = int(total_time_sec * 0.1)
    cooldown_start = int(total_time_sec * 0.9)
    change_interval = 0
    for t in range(total_time_sec):
        if t < warmup_duration:
            target_speed = avg_speed_mps
        elif t > cooldown_start:
            target_speed = avg_speed_mps * 0.85
        elif change_interval <= 0:
            target_speed = avg_speed_mps * random.uniform(0.9, 1.15)
            change_interval = random.randint(45, 75)
        current_speed += (target_speed - current_speed) * 0.1
        speed_profile.append(current_speed)
        change_interval -= 1
    return speed_profile

def generate_run_data(total_km, pace_min_km, run_zone_coords):
    lon_c, lat_c, r_lon, r_lat, circumference_m = calculate_ellipse_params(run_zone_coords)
    total_dist_m = total_km * 1000
    total_time_sec = int(pace_min_km * 60 * total_km)
    avg_speed_mps = total_dist_m / total_time_sec

    print("正在生成真实感速度曲线...")
    speed_profile = generate_realistic_speed_profile(total_time_sec, avg_speed_mps)

    track_points, log_data_list = [], []
    start_time_ts = int(time.time()) - total_time_sec
    log_intervals = [int(total_time_sec * (i + 1) / (LOG_DATA_POINTS + 1)) for i in range(LOG_DATA_POINTS)]
    log_pointer = 0

    current_dist_m = 0.0
    current_time_sec = 0.0
    
    while current_dist_m < total_dist_m:
        time_step = random.uniform(0.8, 1.2)
        if current_time_sec + time_step > total_time_sec:
            time_step = total_time_sec - current_time_sec
            if time_step <= 0: break
        current_time_sec += time_step
        
        time_index = min(int(current_time_sec), len(speed_profile) - 1)
        current_speed_mps = speed_profile[time_index]
        dist_this_step = current_speed_mps * time_step
        current_dist_m += dist_this_step

        angle = (current_dist_m / circumference_m) * 2 * math.pi
        perfect_lon, perfect_lat = lon_c + r_lon * math.cos(angle), lat_c + r_lat * math.sin(angle)
        noisy_lat, noisy_lon = add_gps_noise(perfect_lat, perfect_lon, NOISE_FACTOR_METERS)
        point_speed = max(0, current_speed_mps + random.uniform(-0.15, 0.15))

        point = {
            "a": noisy_lat,                                     # 纬度
            "o": noisy_lon,                                     # 经度
            "s": round(point_speed, 2),                         # 速度
            "p": None,                                          # 暂停标记 (None会转为null)
            "b": int(current_dist_m),                           # 当前总距离
            "c": round(1000 / point_speed / 60, 2) if point_speed > 0 else 0, # 配速
            "d": ['i', 'o', 'n', 'g'][len(track_points) % 4],    # 描述
            "e": None,                                          # 预留 (None会转为null)
            "l": None                                           # 信号丢失 (None会转为null)
        }
        track_points.append(point)

        if log_pointer < len(log_intervals) and current_time_sec >= log_intervals[log_pointer]:
            log_data_list.append({
                "latitude": noisy_lat, "longitude": noisy_lon, "longtitude": noisy_lon,
                "distance": round(current_dist_m / 1000, 2),
                "point_id": str(len(log_data_list) + 1), "time": start_time_ts + int(current_time_sec)
            })
            log_pointer += 1

    return track_points, log_data_list, total_time_sec

def aes_encrypt_base64(text: str) -> str:
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    return base64.b64encode(cipher.encrypt(pad(text.encode('utf-8'), AES.block_size))).decode('utf-8')

def aes_decrypt_base64(encrypted_text: str) -> dict:
    decoded_bytes = base64.b64decode(encrypted_text)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    decrypted_padded_bytes = cipher.decrypt(decoded_bytes)
    decrypted_unpadded_bytes = unpad(decrypted_padded_bytes, AES.block_size)
    return json.loads(decrypted_unpadded_bytes.decode('utf-8'))

def sign_md5(params: dict) -> str:
    string_to_sign = "".join(f"{k}{v}" for k, v in sorted(params.items())) + SECRET_KEY
    return hashlib.md5(string_to_sign.encode('utf-8')).hexdigest()

def create_oss_policy_and_signature(access_key_secret: str) -> tuple[str, str]:
    expiration = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat().replace('+00:00', 'Z')
    policy_doc = {"expiration": expiration, "conditions": [["content-length-range", 0, 1073741824]]}
    policy_b64 = base64.b64encode(json.dumps(policy_doc).encode('utf-8')).decode('utf-8')
    signature = base64.b64encode(hmac.new(access_key_secret.encode('utf-8'), policy_b64.encode('utf-8'), hashlib.sha1).digest()).decode('utf-8')
    return policy_b64, signature

def post_api(path: str, body: dict, common_overrides: dict = {}) -> dict:
    ts, nonce = int(time.time()), random.randint(100000, 999999)
    common_params = {
        "uid": UID, "token": TOKEN, "school_id": SCHOOL_ID, "term_id": 1, "course_id": 0,
        "class_id": 0, "student_num": STUDENT_NUM, "card_id": CARD_ID, "timestamp": ts,
        "version": 1, "nonce": nonce, "ostype": 5
    }
    common_params.update(common_overrides)
    payload = {**common_params, **body}
    payload["sign"] = sign_md5({k: v for k, v in payload.items() if k != 'sign'})
    encrypted_data = aes_encrypt_base64(json.dumps(payload, separators=(',', ':')))
    
    try:
        response = requests.post(BASE_URL + path, data={"ostype": 5, "data": encrypted_data}, timeout=10)
        response.raise_for_status()
        resp_json = response.json()
        if resp_json.get("status") == 1 and resp_json.get("is_encrypt") == 1 and "data" in resp_json:
            resp_json["data"] = aes_decrypt_base64(resp_json["data"])
        return resp_json
    except requests.RequestException as e:
        return {"status": -1, "info": str(e)}

def get_run_config(game_id: str):
    print(f"\n[步骤 1/4] 获取跑区 {game_id} 的配置...")
    return post_api("/v3/api.php/Run2/beforeRunV260", {})

def main():
    config_resp = get_run_config(TARGET_RUN_ZONE_ID)
    if not config_resp or config_resp.get("status") != 1:
        print("获取跑区配置失败:", config_resp.get("info", "未知错误")); return
    run_config = config_resp["data"]
    print(f"获取配置成功: {run_config.get('run_zone_name')}, 学期ID: {run_config.get('term_id')}")

    print(f"\n=== 开始模拟乐跑: {DISTANCE_KM}km @ {PACE_MIN_PER_KM}min/km ===")
    
    run_zone = run_config.get("run_zone_latlng", RUN_ZONE_COORDS)
    if not run_zone:
        print("错误：无法获取跑区范围，请检查配置或API响应。")
        return
        
    track, log_data, used_time = generate_run_data(DISTANCE_KM, PACE_MIN_PER_KM, run_zone)
    print(f"生成轨迹点 {len(track)} 个, 模拟用时 {used_time} 秒, 模拟打卡点 {len(log_data)} 个.")
    
    # 注意：这里的 separators=(',', ':') 很重要，可以压缩JSON体积，符合逆向结果
    encrypted_track_str = aes_encrypt_base64(json.dumps(track, separators=(',', ':')))
    track_filename = "track_encrypted.txt"
    with open(track_filename, "w") as f: f.write(encrypted_track_str)
    print(f"加密轨迹已写入文件: {track_filename}")

    print("\n[步骤 2/4] 获取OSS上传凭证...")
    sts_resp = post_api("/v3/api.php/WpIndex/getOssSts", {})
    if not sts_resp or sts_resp.get("status") != 1:
        print("获取OSS凭证失败:", sts_resp.get("info", "未知错误")); return
    sts = sts_resp["data"]
    print("获取OSS凭证成功.")

    print("\n[步骤 3/4] 上传轨迹文件到OSS...")
    policy, signature = create_oss_policy_and_signature(sts["AccessKeySecret"])
    
    ts_ms_dir = int(time.time() * 1000)
    time.sleep(random.uniform(0.01, 0.05)) 
    ts_ms_file = int(time.time() * 1000)

    dir_suffix = str(ts_ms_dir)[-3:]
    filename = f"{ts_ms_file}-{random.randint(0, 149)}.txt"
    
    oss_key = f"{OSS_DIR_PREFIX}/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/{dir_suffix}/{filename}"
    
    record_file_path = oss_key.replace(f"{OSS_DIR_PREFIX}/", "run_record/")
    
    if not DEBUG:
        oss_url = f"https://{sts['bucket']}.oss-cn-hangzhou.aliyuncs.com"
        form_data = {'key': oss_key, 'policy': policy, 'OSSAccessKeyId': sts['AccessKeyId'], 'signature': signature, 'x-oss-security-token': sts['SecurityToken']}
        with open(track_filename, 'rb') as f:
            upload_resp = requests.post(oss_url, data=form_data, files={'file': (track_filename, f)}, timeout=20)
        if upload_resp.status_code != 204:
            print(f"上传轨迹文件失败: {upload_resp.status_code}\n{upload_resp.text}"); return
    
    print("上传轨迹文件成功. 路径:", record_file_path)

    print("\n[步骤 4/4] 提交跑步记录...")
    end_time, start_time = int(time.time()), int(time.time()) - used_time
    stop_run_body = {
        "game_id": TARGET_RUN_ZONE_ID, "start_time": start_time, "end_time": end_time,
        "distance": float(DISTANCE_KM), "record_img": "",
        "log_data": json.dumps(log_data, separators=(',', ':')), "file_img": "",
        "is_running_area_valid": 1, "mobileDeviceId": 1, "mobileModel": MOBILE_MODEL,
        "mobileOsVersion": 1, "step_info": json.dumps({"interval": 60, "list": []}),
        "step_num": 1, "used_time": used_time, "record_file": record_file_path,
    }
    
    final_resp = post_api("/v3/api.php/Run/stopRunV278", stop_run_body, common_overrides={"term_id": run_config.get("term_id")})
    
    if final_resp and final_resp.get("status") == 1:
        print("\n=== 模拟成功! ===")
        print("服务器响应:", final_resp.get("data"))
    else:
        print("\n=== 模拟失败 ===")
        print("服务器响应:", final_resp)

if __name__ == "__main__":
    main()
```

