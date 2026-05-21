import {
    TOKEN_CLOSE_TAG,
    TOKEN_OPEN_TAG,
    TOKEN_PLACEHOLDER,
    TOKEN_SELF_TAG,
    TOKEN_TEXT,
    type TokenType,
} from './constants'
import type { Syntax } from './syntax'

interface BaseToken<T extends TokenType> {
    type: T
    string: string
    start: number
    end: number
}

export interface PlaceholderToken extends BaseToken<typeof TOKEN_PLACEHOLDER> {
    name: string
}

export interface OpenTagToken extends BaseToken<typeof TOKEN_OPEN_TAG> {
    name: string
}

export interface CloseTagToken extends BaseToken<typeof TOKEN_CLOSE_TAG> {
    name: string
}

export interface SelfTagToken extends BaseToken<typeof TOKEN_SELF_TAG> {
    name: string
}

export interface TextToken extends BaseToken<typeof TOKEN_TEXT> {
    text: string
}

export type Token = PlaceholderToken | OpenTagToken | CloseTagToken | SelfTagToken | TextToken

/*
 * Return an array of token objects.
 */
export default function lexer(string: string, syntax: Syntax): Token[] {
    const matches: Token[] = []

    for (const rule of syntax) {
        const { type, regex } = rule

        regex.lastIndex = 0

        let result: RegExpExecArray | null
        while ((result = regex.exec(string)) !== null) {
            matches.push({
                type,
                string: result[0],
                name: result[1],
                start: result.index,
                end: result.index + result[0].length,
            } as Token)
        }
    }

    matches.sort((a, b) => a.start - b.start)
    const textTokens: TextToken[] = []

    let start = 0
    matches.forEach((match) => {
        if (match.start === start) {
            start = match.end
            return
        }

        const end = match.start
        const text = string.substring(start, end)

        textTokens.push({
            type: TOKEN_TEXT,
            string: text,
            text,
            start,
            end,
        })

        start = match.end
    })

    const trailingText = string.substring(start)
    if (trailingText !== '') {
        textTokens.push({
            type: TOKEN_TEXT,
            string: trailingText,
            text: trailingText,
            start,
            end: string.length,
        })
    }

    return [...textTokens, ...matches].sort((a, b) => a.start - b.start)
}
