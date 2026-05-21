import {
    TOKEN_CLOSE_TAG,
    TOKEN_OPEN_TAG,
    TOKEN_PLACEHOLDER,
    TOKEN_SELF_TAG,
    type SyntaxTokenType,
} from './constants'

export interface SyntaxRule<T extends SyntaxTokenType = SyntaxTokenType> {
    type: T
    regex: RegExp
}

export type Syntax = SyntaxRule[]

export const SYNTAX_BUILT_IN: Syntax = [
    {
        type: TOKEN_PLACEHOLDER,
        regex: /{\s*(\w+)\s*}/g,
    },
    {
        type: TOKEN_OPEN_TAG,
        regex: /<(\w+)>/g,
    },
    {
        type: TOKEN_CLOSE_TAG,
        regex: /<\/(\w+)>/g,
    },
    { type: TOKEN_SELF_TAG, regex: /<(\w+)\s*\/>/g },
]

export const SYNTAX_I18NEXT: Syntax = [
    {
        type: TOKEN_PLACEHOLDER,
        regex: /{{\s*(\w+)\s*}}/g,
    },
    {
        type: TOKEN_OPEN_TAG,
        regex: /<(\w+)>/g,
    },
    {
        type: TOKEN_CLOSE_TAG,
        regex: /<\/(\w+)>/g,
    },
    { type: TOKEN_SELF_TAG, regex: /<(\w+)\s*\/>/g },
]
