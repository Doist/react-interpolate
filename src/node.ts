import {
    NODE_FRAGMENT,
    NODE_PLACEHOLDER,
    NODE_TAG_ELEMENT,
    NODE_TEXT,
    NODE_VOID_ELEMENT,
} from './constants'
import type { OpenTagToken, PlaceholderToken, SelfTagToken, TextToken } from './lexer'

export interface FragmentNode {
    type: typeof NODE_FRAGMENT
    children: SyntaxNode[]
}

export interface TagNode {
    type: typeof NODE_TAG_ELEMENT
    children: SyntaxNode[]
    name: string
    string: string
    token: OpenTagToken
}

export interface VoidNode {
    type: typeof NODE_VOID_ELEMENT
    children: []
    name: string
    string: string
    token: SelfTagToken
}

export interface TextNode {
    type: typeof NODE_TEXT
    children: []
    text: string
    string: string
    token: TextToken
}

export interface PlaceholderNode {
    type: typeof NODE_PLACEHOLDER
    children: []
    name: string
    string: string
    token: PlaceholderToken
}

export type SyntaxNode = FragmentNode | TagNode | VoidNode | TextNode | PlaceholderNode

export function createFragmentNode(children: SyntaxNode[]): FragmentNode {
    return {
        type: NODE_FRAGMENT,
        children,
    }
}

export function createTagNode(token: OpenTagToken, children: SyntaxNode[]): TagNode {
    return {
        type: NODE_TAG_ELEMENT,
        children,
        name: token.name,
        string: token.string,
        token,
    }
}

export function createVoidNode(token: SelfTagToken): VoidNode {
    return {
        type: NODE_VOID_ELEMENT,
        children: [],
        name: token.name,
        string: token.string,
        token,
    }
}

export function createTextNode(token: TextToken): TextNode {
    return {
        type: NODE_TEXT,
        children: [],
        text: token.text,
        string: token.string,
        token,
    }
}

export function createPlaceholderNode(token: PlaceholderToken): PlaceholderNode {
    return {
        type: NODE_PLACEHOLDER,
        children: [],
        name: token.name,
        string: token.string,
        token,
    }
}
