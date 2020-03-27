import {
    NODE_FRAGMENT,
    NODE_TAG_ELEMENT,
    NODE_VOID_ELEMENT,
    NODE_PLACEHOLDER,
    NODE_TEXT
} from "./constants"

export default class Node {
    constructor({ type, children, ...fields }) {
        this.type = type
        this.children = children || []

        for (const key in fields) {
            this[key] = fields[key]
        }

        if (fields.token) {
            this.string = fields.token.string
        }
    }

    appendChild(child) {
        this.children.push(child)
    }

    get isLeaf() {
        return this.children.length === 0
    }
}

Node.createTagNode = (token, children) =>
    new Node({
        type: NODE_TAG_ELEMENT,
        children,
        name: token.name,
        token
    })

Node.createFragmentNode = children =>
    new Node({
        type: NODE_FRAGMENT,
        children
    })

Node.createVoidNode = token =>
    new Node({
        type: NODE_VOID_ELEMENT,
        name: token.name,
        token
    })

Node.createTextNode = token =>
    new Node({
        type: NODE_TEXT,
        text: token.string,
        token
    })

Node.createPlaceholderNode = token =>
    new Node({
        type: NODE_PLACEHOLDER,
        name: token.name,
        token
    })
