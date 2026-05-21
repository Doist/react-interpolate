export const TOKEN_PLACEHOLDER = 'TOKEN_PLACEHOLDER' as const
export const TOKEN_OPEN_TAG = 'TOKEN_OPEN_TAG' as const
export const TOKEN_CLOSE_TAG = 'TOKEN_CLOSE_TAG' as const
export const TOKEN_SELF_TAG = 'TOKEN_SELF_TAG' as const
export const TOKEN_TEXT = 'TOKEN_TEXT' as const

export const NODE_FRAGMENT = 'NODE_FRAGMENT' as const
export const NODE_TAG_ELEMENT = 'NODE_TAG_ELEMENT' as const
export const NODE_VOID_ELEMENT = 'NODE_VOID_ELEMENT' as const
export const NODE_PLACEHOLDER = 'NODE_PLACEHOLDER' as const
export const NODE_TEXT = 'NODE_TEXT' as const

export type TokenType =
    | typeof TOKEN_PLACEHOLDER
    | typeof TOKEN_OPEN_TAG
    | typeof TOKEN_CLOSE_TAG
    | typeof TOKEN_SELF_TAG
    | typeof TOKEN_TEXT

export type SyntaxTokenType = Exclude<TokenType, typeof TOKEN_TEXT>

export type NodeType =
    | typeof NODE_FRAGMENT
    | typeof NODE_TAG_ELEMENT
    | typeof NODE_VOID_ELEMENT
    | typeof NODE_PLACEHOLDER
    | typeof NODE_TEXT
