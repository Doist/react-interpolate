import {
  TOKEN_CLOSE_TAG,
  TOKEN_OPEN_TAG,
  TOKEN_PLACEHOLDER,
  TOKEN_SELF_TAG,
  type SyntaxTokenType,
} from "./constants";

export interface SyntaxRule<T extends SyntaxTokenType = SyntaxTokenType> {
  type: T;
  regex: RegExp;
  getName(match: RegExpExecArray): string;
}

export type Syntax = SyntaxRule[];

function getCapturedName(match: RegExpExecArray, captureGroup: number): string {
  const name = match[captureGroup];

  if (name === undefined) {
    throw new Error("Syntax rule must capture a token name");
  }

  return name;
}

export function createSyntaxRule<T extends SyntaxTokenType>(
  type: T,
  regex: RegExp,
  captureGroup: number,
): SyntaxRule<T> {
  if (!regex.global) {
    throw new Error("Syntax rule regex must use the global flag");
  }

  if (!Number.isInteger(captureGroup) || captureGroup < 1) {
    throw new Error("Syntax rule capture group must be a positive integer");
  }

  return {
    type,
    regex,
    getName(match) {
      return getCapturedName(match, captureGroup);
    },
  };
}

export const SYNTAX_BUILT_IN: Syntax = [
  createSyntaxRule(TOKEN_PLACEHOLDER, /{\s*(\w+)\s*}/g, 1),
  createSyntaxRule(TOKEN_OPEN_TAG, /<(\w+)>/g, 1),
  createSyntaxRule(TOKEN_CLOSE_TAG, /<\/(\w+)>/g, 1),
  createSyntaxRule(TOKEN_SELF_TAG, /<(\w+)\s*\/>/g, 1),
];

export const SYNTAX_I18NEXT: Syntax = [
  createSyntaxRule(TOKEN_PLACEHOLDER, /{{\s*(\w+)\s*}}/g, 1),
  createSyntaxRule(TOKEN_OPEN_TAG, /<(\w+)>/g, 1),
  createSyntaxRule(TOKEN_CLOSE_TAG, /<\/(\w+)>/g, 1),
  createSyntaxRule(TOKEN_SELF_TAG, /<(\w+)\s*\/>/g, 1),
];
