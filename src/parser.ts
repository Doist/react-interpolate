import {
  TOKEN_CLOSE_TAG,
  TOKEN_OPEN_TAG,
  TOKEN_PLACEHOLDER,
  TOKEN_SELF_TAG,
  TOKEN_TEXT,
  type TokenType,
} from "./constants";
import lexer, { type OpenTagToken, type Token } from "./lexer";
import {
  createFragmentNode,
  createPlaceholderNode,
  createTagNode,
  createTextNode,
  createVoidNode,
  type FragmentNode,
  type SyntaxNode,
} from "./node";
import { SYNTAX_BUILT_IN, type Syntax } from "./syntax";

const SYNTAX_ERROR = "Syntax error. Please check if each open tag is closed correctly";

type EpsilonToken = {
  type: "EPSILON";
};

type LookaheadToken = Token | EpsilonToken;
type TokenByType<T extends TokenType> = Extract<Token, { type: T }>;

// A special token representing end of the stream.
const EPSILON: EpsilonToken = {
  type: "EPSILON",
};

function isTokenOfType<T extends TokenType>(
  token: Token | undefined,
  type: T,
): token is TokenByType<T> {
  return token?.type === type;
}

export default function parser(string: string, syntax: Syntax = SYNTAX_BUILT_IN): FragmentNode {
  const tokens = lexer(string, syntax);
  const parserInstance = new Parser(tokens);

  return parserInstance.parse();
}

/*
 * A recursive descent parser that constructs a syntax tree representing
 * the DOM hierarchy structure.
 */
class Parser {
  private readonly tokens: Token[];
  private readonly tags: OpenTagToken[];

  constructor(tokens: Token[]) {
    this.tokens = [...tokens];
    this.tags = [];
  }

  parse(): FragmentNode {
    const tree = this.document();
    if (!this.predict(EPSILON.type)) {
      throw new Error(SYNTAX_ERROR);
    }

    return tree;
  }

  document(): FragmentNode {
    const children = this.elementOrData();
    return createFragmentNode(children);
  }

  element(): SyntaxNode {
    const tagToken = this.openTag();
    const children = this.elementOrData();
    this.endTag();

    return createTagNode(tagToken, children);
  }

  openTag(): OpenTagToken {
    const token = this.match(TOKEN_OPEN_TAG);
    this.pushTag(token);

    return token;
  }

  elementOrData(): SyntaxNode[] {
    const children: SyntaxNode[] = [];

    for (;;) {
      const { type } = this.lookahead;

      switch (type) {
        case TOKEN_OPEN_TAG:
          children.push(this.element());
          continue;

        case TOKEN_SELF_TAG:
          children.push(createVoidNode(this.match(TOKEN_SELF_TAG)));
          continue;

        case TOKEN_TEXT:
          children.push(createTextNode(this.match(TOKEN_TEXT)));
          continue;

        case TOKEN_PLACEHOLDER:
          children.push(createPlaceholderNode(this.match(TOKEN_PLACEHOLDER)));
          continue;

        default:
          return children;
      }
    }
  }

  endTag(): void {
    const openTag = this.tags.pop();
    const closeTag = this.match(TOKEN_CLOSE_TAG);

    if (!openTag || openTag.name !== closeTag.name) {
      throw new Error(SYNTAX_ERROR);
    }
  }

  get lookahead(): LookaheadToken {
    return this.tokens[0] ?? EPSILON;
  }

  predict(...types: Array<TokenType | EpsilonToken["type"]>): boolean {
    return types.includes(this.lookahead.type);
  }

  match<T extends TokenType>(type: T): TokenByType<T> {
    const token = this.tokens.shift();

    if (!isTokenOfType(token, type)) {
      throw new Error(SYNTAX_ERROR);
    }

    return token;
  }

  pushTag(token: OpenTagToken): void {
    this.tags.push(token);
  }
}
