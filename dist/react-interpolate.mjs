import React from 'react';
import PropTypes from 'prop-types';

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};

  var target = _objectWithoutPropertiesLoose(source, excluded);

  var key, i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

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

/*
 * return a array of token object
 */

function lexer(string) {
  var _regxMap;

  var regxMap = (_regxMap = {}, _defineProperty(_regxMap, TOKEN_PLACEHOLDER, /{\s*(\w+)\s*}/g), _defineProperty(_regxMap, TOKEN_OPEN_TAG, /<(\w+)>/g), _defineProperty(_regxMap, TOKEN_CLOSE_TAG, /<\/(\w+)>/g), _defineProperty(_regxMap, TOKEN_SELF_TAG, /<(\w+)\s*\/>/g), _regxMap);
  var matches = [];

  for (var tokenType in regxMap) {
    var regx = regxMap[tokenType];
    var res;

    while ((res = regx.exec(string)) !== null) {
      matches.push({
        type: tokenType,
        string: res[0],
        name: res[1],
        start: res.index,
        end: res.index + res[0].length
      });
    }
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

function parser(string) {
  var tokens = lexer(string);
  var p = new Parser(tokens);
  return p.parse();
}
var SYNTAX_ERROR = "syntax error"; // A special token representing end of the tream

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

        if (typeof _val === "function") {
          return _val(children);
        }

        if (_val !== undefined) {
          throw new Error("tag \"".concat(node.name, "\" should be mapped to a renderer function"));
        }

        return React.createElement(node.name, null, children);
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
      _ref$mapping = _ref.mapping,
      mapping = _ref$mapping === void 0 ? {} : _ref$mapping,
      _ref$graceful = _ref.graceful,
      graceful = _ref$graceful === void 0 ? true : _ref$graceful;

  try {
    var tree = parser(string);
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

export default Interpolate;
