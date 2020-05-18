import {
    TOKEN_PLACEHOLDER,
    TOKEN_OPEN_TAG,
    TOKEN_CLOSE_TAG,
    TOKEN_SELF_TAG
} from "./constants"

export const SYNTAX_BUILT_IN = [
    {
        type: TOKEN_PLACEHOLDER,
        regex: /{\s*(\w+)\s*}/g
    },
    {
        type: TOKEN_OPEN_TAG,
        regex: /<(\w+)>/g
    },
    {
        type: TOKEN_CLOSE_TAG,
        regex: /<\/(\w+)>/g
    },
    { type: TOKEN_SELF_TAG, regex: /<(\w+)\s*\/>/g }
]

export const SYNTAX_I18NEXT = [
    {
        type: TOKEN_PLACEHOLDER,
        regex: /{{\s*(\w+)\s*}}/g
    },
    {
        type: TOKEN_OPEN_TAG,
        regex: /<(\w+)>/g
    },
    {
        type: TOKEN_CLOSE_TAG,
        regex: /<\/(\w+)>/g
    },
    { type: TOKEN_SELF_TAG, regex: /<(\w+)\s*\/>/g }
]
