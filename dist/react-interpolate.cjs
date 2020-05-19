'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = _interopDefault(require('react'));
var PropTypes = _interopDefault(require('prop-types'));
var _classCallCheck = _interopDefault(require('@babel/runtime/helpers/classCallCheck'));
var _createClass = _interopDefault(require('@babel/runtime/helpers/createClass'));
var _objectWithoutProperties = _interopDefault(require('@babel/runtime/helpers/objectWithoutProperties'));

var TOKEN_PLACEHOLDER = "TOKEN_PLACEHOLDER";
var TOKEN_OPEN_TAG = "TOKEN_OPEN_TAG";
var TOKEN_CLOSE_TAG = "TOKEN_CLOSE_TAG";
var TOKEN_SELF_TAG = "TOKEN_SELF_TAG";
var TOKEN_TEXT = "TOKEN_TEXT";
var NODE_FRAGMENT = "NODE_FRAGMENT";
var NODE_TAG_ELEMENT = "NODE_TAG_ELEMENT";
var NODE_VOID_ELEMENT = "NODE_VOID_ELEMENT";
var NODE_PLACEHOLDER = "NODE_PLACEHOLDER";
var NODE_TEXT = "NODE_TEXT";

var Node = /*#__PURE__*/function () {
  function Node(_ref) {
    var type = _ref.type,
        children = _ref.children,
        fields = _objectWithoutProperties(_ref, ["type", "children"]);

    _classCallCheck(this, Node);

    this.type = type;
    this.children = children || [];

    for (var key in fields) {
      this[key] = fields[key];
    }

    if (fields.token) {
      this.string = fields.token.string;
    }
  }

  _createClass(Node, [{
    key: "appendChild",
    value: function appendChild(child) {
      this.children.push(child);
    }
  }, {
    key: "isLeaf",
    get: function get() {
      return this.children.length === 0;
    }
  }]);

  return Node;
}();

Node.createTagNode = function (token, children) {
  return new Node({
    type: NODE_TAG_ELEMENT,
    children: children,
    name: token.name,
    token: token
  });
};

Node.createFragmentNode = function (children) {
  return new Node({
    type: NODE_FRAGMENT,
    children: children
  });
};

Node.createVoidNode = function (token) {
  return new Node({
    type: NODE_VOID_ELEMENT,
    name: token.name,
    token: token
  });
};

Node.createTextNode = function (token) {
  return new Node({
    type: NODE_TEXT,
    text: token.string,
    token: token
  });
};

Node.createPlaceholderNode = function (token) {
  return new Node({
    type: NODE_PLACEHOLDER,
    name: token.name,
    token: token
  });
};

var SYNTAX_BUILT_IN = [{
  type: TOKEN_PLACEHOLDER,
  regex: /{\s*(\w+)\s*}/g
}, {
  type: TOKEN_OPEN_TAG,
  regex: /<(\w+)>/g
}, {
  type: TOKEN_CLOSE_TAG,
  regex: /<\/(\w+)>/g
}, {
  type: TOKEN_SELF_TAG,
  regex: /<(\w+)\s*\/>/g
}];
var SYNTAX_I18NEXT = [{
  type: TOKEN_PLACEHOLDER,
  regex: /{{\s*(\w+)\s*}}/g
}, {
  type: TOKEN_OPEN_TAG,
  regex: /<(\w+)>/g
}, {
  type: TOKEN_CLOSE_TAG,
  regex: /<\/(\w+)>/g
}, {
  type: TOKEN_SELF_TAG,
  regex: /<(\w+)\s*\/>/g
}];

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
/*
 * return a array of token object
 */

function lexer(string, syntax) {
  var matches = [];

  var _iterator = _createForOfIteratorHelper(syntax),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var rule = _step.value;
      var type = rule.type,
          regex = rule.regex;
      var res;

      while ((res = regex.exec(string)) !== null) {
        matches.push({
          type: type,
          string: res[0],
          name: res[1],
          start: res.index,
          end: res.index + res[0].length
        });
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  matches.sort(function (a, b) {
    return a.start - b.start;
  });
  var textTokens = [];
  var start = 0;
  matches.forEach(function (match) {
    if (match.start === start) {
      start = match.end;
      return;
    }

    var end = match.start;
    var text = string.substring(start, end);
    textTokens.push({
      type: TOKEN_TEXT,
      string: text,
      text: text,
      start: start,
      end: end
    });
    start = match.end;
  });
  var text = string.substring(start);

  if (text !== "") {
    textTokens.push({
      type: TOKEN_TEXT,
      string: text,
      start: start,
      end: string.length
    });
  }

  var tokens = [].concat(textTokens, matches).sort(function (a, b) {
    return a.start - b.start;
  });
  return tokens;
}

function parser(string, syntax) {
  if (!syntax) {
    syntax = SYNTAX_BUILT_IN;
  }

  var tokens = lexer(string, syntax);
  var p = new Parser(tokens);
  return p.parse();
}
var SYNTAX_ERROR = "Syntax error. Please check if each open tag is closed correctly"; // A special token representing end of the tream

var EPSILON = {
  type: "EPSILON"
};
/*
 * A recursive descent parser that construct a syntax tree represeting
 * the DOM hierarchy structure.
 *
 * For instance, the following token
 * <h1>hi <b>{name}</b></h1>
 *
 * Would result in the following tree
 *
 * <h1>
 * ├─ "hi"
 * └─ <b>
 *    ├─ {name}
 *
 * The parser is based on the following grammar:
 *
 *   document ::= elementOrData
 *   elementOrData ::= element elementOrData
 *   elementOrData ::= data elementOrData
 *   element ::= <open_tag> elementOrData <close_tag>
 *   data ::= <selfTag>
 *   data ::= <text>
 *   data ::= <placeholder>
 *
 * ref: https://github.com/amghannam/Mini-XML-Recursive-Descent-Parser
 */

var Parser = /*#__PURE__*/function () {
  function Parser(tokens) {
    _classCallCheck(this, Parser);

    this.tokens = [].concat(tokens);
    this.tags = [];
  }

  _createClass(Parser, [{
    key: "parse",
    value: function parse() {
      var tree = this.document();

      if (!this.predict(EPSILON.type)) {
        throw new Error(SYNTAX_ERROR);
      }

      return tree;
    }
    /*
     * @return {Node}
     */

  }, {
    key: "document",
    value: function document() {
      var children = this.elementOrData();
      return Node.createFragmentNode(children);
    }
    /*
     * @return {Node}
     */

  }, {
    key: "element",
    value: function element() {
      var tagToken = this.openTag();
      var children = this.elementOrData();
      this.endTag();
      return Node.createTagNode(tagToken, children);
    }
    /*
     * @return {Token}
     */

  }, {
    key: "openTag",
    value: function openTag() {
      if (!this.predict(TOKEN_OPEN_TAG)) {
        throw new Error(SYNTAX_ERROR);
      }

      this.pushTag(this.lookahead);
      return this.match(TOKEN_OPEN_TAG);
    }
    /*
     * @return {[]Node}
     */

  }, {
    key: "elementOrData",
    value: function elementOrData() {
      var children = [];

      if (this.predict(TOKEN_OPEN_TAG)) {
        children.push(this.element());
        children = children.concat(this.elementOrData());
      }

      if (this.predict(TOKEN_SELF_TAG, TOKEN_TEXT, TOKEN_PLACEHOLDER)) {
        var token = this.match(this.lookahead.type);
        var node;

        switch (token.type) {
          case TOKEN_SELF_TAG:
            node = Node.createVoidNode(token);
            break;

          case TOKEN_TEXT:
            node = Node.createTextNode(token);
            break;

          case TOKEN_PLACEHOLDER:
            node = Node.createPlaceholderNode(token);
            break;
        }

        children.push(node);
        children = children.concat(this.elementOrData());
      }

      return children;
    }
  }, {
    key: "endTag",
    value: function endTag() {
      if (!this.predict(TOKEN_CLOSE_TAG)) {
        throw new Error(SYNTAX_ERROR);
      }

      var openTag = this.tags.pop();

      if (openTag.name !== this.lookahead.name) {
        throw new Error(SYNTAX_ERROR);
      }

      this.match(TOKEN_CLOSE_TAG);
    }
  }, {
    key: "predict",
    value: function predict() {
      for (var _len = arguments.length, types = new Array(_len), _key = 0; _key < _len; _key++) {
        types[_key] = arguments[_key];
      }

      return types.includes(this.lookahead.type);
    }
  }, {
    key: "match",
    value: function match(type) {
      if (!this.predict(type)) {
        throw new Error(SYNTAX_ERROR);
      }

      var token = this.tokens.shift();
      return token;
    }
  }, {
    key: "pushTag",
    value: function pushTag(token) {
      this.tags.push(token);
    }
  }, {
    key: "lookahead",
    get: function get() {
      return this.tokens.length === 0 ? EPSILON : this.tokens[0];
    }
  }]);

  return Parser;
}();

var createElement = function createElement(node, mapping, keyPrefix) {
  var children = node.children.map(function (c, i) {
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: keyPrefix + i
    }, createElement(c, mapping, keyPrefix));
  });

  switch (node.type) {
    case NODE_TEXT:
      {
        return node.text;
      }

    case NODE_FRAGMENT:
      {
        return React.createElement(React.Fragment, null, children);
      }

    case NODE_VOID_ELEMENT:
      {
        var val = mapping[node.name];

        if (typeof val === "function") {
          return val();
        }

        return val || React.createElement(node.name, null);
      }

    case NODE_TAG_ELEMENT:
      {
        var _val = mapping[node.name];

        if (_val === undefined) {
          return React.createElement(node.name, null, children);
        }

        if (typeof _val === "function") {
          return _val(children);
        }

        if (React.isValidElement(_val)) {
          if (React.Children.count(_val.props.children) !== 0) {
            throw new Error("when passing an element as value, the element should not contains children");
          }

          return React.cloneElement(_val, {
            children: children
          });
        }

        throw new Error("Invalid mapping value for \"".concat(node.name, "\". Only element or render function are accepted"));
      }

    case NODE_PLACEHOLDER:
      {
        var _val2 = mapping[node.name];

        if (_val2 === undefined) {
          console.warn("missing \"".concat(node.name, "\" in mapping"));
          return node.string;
        }

        if (typeof _val2 === "function") {
          return _val2();
        }

        return _val2;
      }

    default:
      return;
  }
};

function Interpolate(_ref) {
  var string = _ref.string,
      syntax = _ref.syntax,
      _ref$mapping = _ref.mapping,
      mapping = _ref$mapping === void 0 ? {} : _ref$mapping,
      _ref$graceful = _ref.graceful,
      graceful = _ref$graceful === void 0 ? true : _ref$graceful;

  try {
    var tree = parser(string, syntax);
    return createElement(tree, mapping, string);
  } catch (e) {
    if (graceful) {
      console.error(e);
      return string;
    } else {
      throw e;
    }
  }
}
Interpolate.propTypes = {
  string: PropTypes.string.isRequired,
  mapping: PropTypes.object,
  graceful: PropTypes.bool
};

exports.SYNTAX_BUILT_IN = SYNTAX_BUILT_IN;
exports.SYNTAX_I18NEXT = SYNTAX_I18NEXT;
exports.TOKEN_CLOSE_TAG = TOKEN_CLOSE_TAG;
exports.TOKEN_OPEN_TAG = TOKEN_OPEN_TAG;
exports.TOKEN_PLACEHOLDER = TOKEN_PLACEHOLDER;
exports.TOKEN_SELF_TAG = TOKEN_SELF_TAG;
exports.default = Interpolate;
