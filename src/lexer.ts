import {
  TOKEN_CLOSE_TAG,
  TOKEN_OPEN_TAG,
  TOKEN_PLACEHOLDER,
  TOKEN_SELF_TAG,
  TOKEN_TEXT,
  type SyntaxTokenType,
  type TokenType,
} from "./constants";
import type { Syntax, SyntaxRule } from "./syntax";

interface BaseToken<T extends TokenType> {
  type: T;
  string: string;
  start: number;
  end: number;
}

export interface PlaceholderToken extends BaseToken<typeof TOKEN_PLACEHOLDER> {
  name: string;
}

export interface OpenTagToken extends BaseToken<typeof TOKEN_OPEN_TAG> {
  name: string;
}

export interface CloseTagToken extends BaseToken<typeof TOKEN_CLOSE_TAG> {
  name: string;
}

export interface SelfTagToken extends BaseToken<typeof TOKEN_SELF_TAG> {
  name: string;
}

export interface TextToken extends BaseToken<typeof TOKEN_TEXT> {
  text: string;
}

type SyntaxToken = PlaceholderToken | OpenTagToken | CloseTagToken | SelfTagToken;
export type Token = PlaceholderToken | OpenTagToken | CloseTagToken | SelfTagToken | TextToken;

function createSyntaxToken(rule: SyntaxRule<SyntaxTokenType>, match: RegExpExecArray): SyntaxToken {
  return {
    type: rule.type,
    string: match[0],
    name: rule.getName(match),
    start: match.index,
    end: match.index + match[0].length,
  };
}

function createTextToken(text: string, start: number, end: number): TextToken {
  return {
    type: TOKEN_TEXT,
    string: text,
    text,
    start,
    end,
  };
}

/*
 * Return an array of token objects.
 */
export default function lexer(string: string, syntax: Syntax): Token[] {
  const matches: SyntaxToken[] = [];

  for (const rule of syntax) {
    const { regex } = rule;

    if (!regex.global) {
      throw new Error("Syntax rule regex must use the global flag");
    }

    regex.lastIndex = 0;

    let result: RegExpExecArray | null;
    while ((result = regex.exec(string)) !== null) {
      matches.push(createSyntaxToken(rule, result));
    }
  }

  matches.sort((a, b) => a.start - b.start);
  const textTokens: TextToken[] = [];

  let start = 0;
  matches.forEach((match) => {
    if (match.start === start) {
      start = match.end;
      return;
    }

    const end = match.start;
    const text = string.substring(start, end);

    textTokens.push(createTextToken(text, start, end));

    start = match.end;
  });

  const trailingText = string.substring(start);
  if (trailingText !== "") {
    textTokens.push(createTextToken(trailingText, start, string.length));
  }

  return [...textTokens, ...matches].sort((a, b) => a.start - b.start);
}
