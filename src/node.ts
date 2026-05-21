import {
    NODE_FRAGMENT,
    NODE_PLACEHOLDER,
    NODE_TAG_ELEMENT,
    NODE_TEXT,
    NODE_VOID_ELEMENT,
    type NodeType,
} from './constants'
import type { OpenTagToken, PlaceholderToken, SelfTagToken, TextToken } from './lexer'

type NodeToken = OpenTagToken | PlaceholderToken | SelfTagToken | TextToken

interface NodeFields {
    name?: string
    text?: string
    string?: string
    token?: NodeToken
}

interface NodeParams extends NodeFields {
    type: NodeType
    children?: SyntaxNode[]
}

export default class SyntaxNode {
    type: NodeType
    children: SyntaxNode[]
    name?: string
    text?: string
    string?: string
    token?: NodeToken

    constructor({ type, children = [], ...fields }: NodeParams) {
        this.type = type
        this.children = children

        Object.assign(this, fields)

        if (fields.token) {
            this.string = fields.token.string
        }
    }

    appendChild(child: SyntaxNode): void {
        this.children.push(child)
    }

    get isLeaf(): boolean {
        return this.children.length === 0
    }

    static createTagNode(token: OpenTagToken, children: SyntaxNode[]): SyntaxNode {
        return new SyntaxNode({
            type: NODE_TAG_ELEMENT,
            children,
            name: token.name,
            token,
        })
    }

    static createFragmentNode(children: SyntaxNode[]): SyntaxNode {
        return new SyntaxNode({
            type: NODE_FRAGMENT,
            children,
        })
    }

    static createVoidNode(token: SelfTagToken): SyntaxNode {
        return new SyntaxNode({
            type: NODE_VOID_ELEMENT,
            name: token.name,
            token,
        })
    }

    static createTextNode(token: TextToken): SyntaxNode {
        return new SyntaxNode({
            type: NODE_TEXT,
            text: token.text,
            token,
        })
    }

    static createPlaceholderNode(token: PlaceholderToken): SyntaxNode {
        return new SyntaxNode({
            type: NODE_PLACEHOLDER,
            name: token.name,
            token,
        })
    }
}
