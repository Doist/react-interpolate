import {
    TOKEN_CLOSE_TAG,
    TOKEN_OPEN_TAG,
    TOKEN_PLACEHOLDER,
    TOKEN_SELF_TAG,
    TOKEN_TEXT,
    type SyntaxTokenType,
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

type SyntaxToken = PlaceholderToken | OpenTagToken | CloseTagToken | SelfTagToken
export type Token = PlaceholderToken | OpenTagToken | CloseTagToken | SelfTagToken | TextToken

function getMatchName(match: RegExpExecArray): string {
    const name = match[1]

    if (name === undefined) {
        throw new Error('Syntax rule must capture a token name')
    }

    return name
}

function createSyntaxToken(type: SyntaxTokenType, match: RegExpExecArray): SyntaxToken {
    return {
        type,
        string: match[0],
        name: getMatchName(match),
        start: match.index,
        end: match.index + match[0].length,
    }
}

/*
 * Return an array of token objects.
 */
export default function lexer(string: string, syntax: Syntax): Token[] {
    const matches: SyntaxToken[] = []

    for (const rule of syntax) {
        const { type, regex } = rule

        regex.lastIndex = 0

        let result: RegExpExecArray | null
        while ((result = regex.exec(string)) !== null) {
            matches.push(createSyntaxToken(type, result))
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
