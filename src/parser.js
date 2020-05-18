import {
    TOKEN_PLACEHOLDER,
    TOKEN_OPEN_TAG,
    TOKEN_CLOSE_TAG,
    TOKEN_SELF_TAG,
    TOKEN_TEXT
} from "./constants"
import Node from "./node.js"
import lexer from "./lexer"
import { SYNTAX_BUILT_IN } from "./syntax"

export default function parser(string, syntax) {
    if (!syntax) {
        syntax = SYNTAX_BUILT_IN
    }

    const tokens = lexer(string, syntax)
    const p = new Parser(tokens)
    return p.parse()
}

const SYNTAX_ERROR = "syntax error"

// A special token representing end of the tream
const EPSILON = {
    type: "EPSILON"
}

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
class Parser {
    constructor(tokens) {
        this.tokens = [].concat(tokens)
        this.tags = []
    }

    parse() {
        const tree = this.document()
        if (!this.predict(EPSILON.type)) {
            throw new Error(SYNTAX_ERROR)
        }

        return tree
    }

    /*
     * @return {Node}
     */
    document() {
        const children = this.elementOrData()
        return Node.createFragmentNode(children)
    }

    /*
     * @return {Node}
     */
    element() {
        const tagToken = this.openTag()
        const children = this.elementOrData()
        this.endTag()

        return Node.createTagNode(tagToken, children)
    }

    /*
     * @return {Token}
     */
    openTag() {
        if (!this.predict(TOKEN_OPEN_TAG)) {
            throw new Error(SYNTAX_ERROR)
        }
        this.pushTag(this.lookahead)
        return this.match(TOKEN_OPEN_TAG)
    }

    /*
     * @return {[]Node}
     */
    elementOrData() {
        let children = []

        if (this.predict(TOKEN_OPEN_TAG)) {
            children.push(this.element())
            children = children.concat(this.elementOrData())
        }

        if (this.predict(TOKEN_SELF_TAG, TOKEN_TEXT, TOKEN_PLACEHOLDER)) {
            const token = this.match(this.lookahead.type)

            let node
            switch (token.type) {
                case TOKEN_SELF_TAG:
                    node = Node.createVoidNode(token)
                    break
                case TOKEN_TEXT:
                    node = Node.createTextNode(token)
                    break
                case TOKEN_PLACEHOLDER:
                    node = Node.createPlaceholderNode(token)
                    break
            }

            children.push(node)
            children = children.concat(this.elementOrData())
        }

        return children
    }

    endTag() {
        if (!this.predict(TOKEN_CLOSE_TAG)) {
            throw new Error(SYNTAX_ERROR)
        }

        const openTag = this.tags.pop()
        if (openTag.name !== this.lookahead.name) {
            throw new Error(SYNTAX_ERROR)
        }

        this.match(TOKEN_CLOSE_TAG)
    }

    get lookahead() {
        return this.tokens.length === 0 ? EPSILON : this.tokens[0]
    }

    predict(...types) {
        return types.includes(this.lookahead.type)
    }

    match(type) {
        if (!this.predict(type)) {
            throw new Error(SYNTAX_ERROR)
        }
        const token = this.tokens.shift()
        return token
    }

    pushTag(token) {
        this.tags.push(token)
    }
}
