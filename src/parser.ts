import {
    TOKEN_CLOSE_TAG,
    TOKEN_OPEN_TAG,
    TOKEN_PLACEHOLDER,
    TOKEN_SELF_TAG,
    TOKEN_TEXT,
    type TokenType,
} from './constants'
import lexer, { type OpenTagToken, type Token } from './lexer'
import SyntaxNode from './node'
import { SYNTAX_BUILT_IN, type Syntax } from './syntax'

const SYNTAX_ERROR = 'Syntax error. Please check if each open tag is closed correctly'

type EpsilonToken = {
    type: 'EPSILON'
}

type LookaheadToken = Token | EpsilonToken
type TokenByType<T extends TokenType> = Extract<Token, { type: T }>

// A special token representing end of the stream.
const EPSILON: EpsilonToken = {
    type: 'EPSILON',
}

export default function parser(string: string, syntax: Syntax = SYNTAX_BUILT_IN): SyntaxNode {
    const tokens = lexer(string, syntax)
    const parserInstance = new Parser(tokens)

    return parserInstance.parse()
}

/*
 * A recursive descent parser that constructs a syntax tree representing
 * the DOM hierarchy structure.
 */
class Parser {
    private readonly tokens: Token[]
    private readonly tags: OpenTagToken[]

    constructor(tokens: Token[]) {
        this.tokens = [...tokens]
        this.tags = []
    }

    parse(): SyntaxNode {
        const tree = this.document()
        if (!this.predict(EPSILON.type)) {
            throw new Error(SYNTAX_ERROR)
        }

        return tree
    }

    document(): SyntaxNode {
        const children = this.elementOrData()
        return SyntaxNode.createFragmentNode(children)
    }

    element(): SyntaxNode {
        const tagToken = this.openTag()
        const children = this.elementOrData()
        this.endTag()

        return SyntaxNode.createTagNode(tagToken, children)
    }

    openTag(): OpenTagToken {
        const token = this.match(TOKEN_OPEN_TAG)
        this.pushTag(token)

        return token
    }

    elementOrData(): SyntaxNode[] {
        const children: SyntaxNode[] = []

        while (this.predict(TOKEN_OPEN_TAG, TOKEN_SELF_TAG, TOKEN_TEXT, TOKEN_PLACEHOLDER)) {
            if (this.predict(TOKEN_OPEN_TAG)) {
                children.push(this.element())
                continue
            }

            if (this.predict(TOKEN_SELF_TAG)) {
                children.push(SyntaxNode.createVoidNode(this.match(TOKEN_SELF_TAG)))
                continue
            }

            if (this.predict(TOKEN_TEXT)) {
                children.push(SyntaxNode.createTextNode(this.match(TOKEN_TEXT)))
                continue
            }

            if (this.predict(TOKEN_PLACEHOLDER)) {
                children.push(SyntaxNode.createPlaceholderNode(this.match(TOKEN_PLACEHOLDER)))
            }
        }

        return children
    }

    endTag(): void {
        const openTag = this.tags.pop()
        const closeTag = this.match(TOKEN_CLOSE_TAG)

        if (!openTag || openTag.name !== closeTag.name) {
            throw new Error(SYNTAX_ERROR)
        }
    }

    get lookahead(): LookaheadToken {
        return this.tokens[0] ?? EPSILON
    }

    predict(...types: Array<TokenType | EpsilonToken['type']>): boolean {
        return types.includes(this.lookahead.type)
    }

    match<T extends TokenType>(type: T): TokenByType<T> {
        if (!this.predict(type)) {
            throw new Error(SYNTAX_ERROR)
        }

        return this.tokens.shift() as TokenByType<T>
    }

    pushTag(token: OpenTagToken): void {
        this.tags.push(token)
    }
}
