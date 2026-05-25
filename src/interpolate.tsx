import React from "react";
import {
  NODE_FRAGMENT,
  NODE_PLACEHOLDER,
  NODE_TAG_ELEMENT,
  NODE_TEXT,
  NODE_VOID_ELEMENT,
} from "./constants";
import type { SyntaxNode } from "./node";
import parser from "./parser";
import type { Syntax } from "./syntax";

export type MappingRenderFunction =
  | (() => React.ReactNode)
  | ((children: React.ReactNode) => React.ReactNode);
export type MappingValue = React.ReactNode | MappingRenderFunction;
export type Mapping = Record<string, MappingValue>;

export interface InterpolateProps {
  string: string;
  syntax?: Syntax;
  mapping?: Mapping;
  graceful?: boolean;
}

function assertNever(node: never): never {
  throw new Error(`Unexpected node type: ${JSON.stringify(node)}`);
}

function createElement(node: SyntaxNode, mapping: Mapping, keyPrefix: string): React.ReactNode {
  const children = node.children.map((child, index) => (
    <React.Fragment key={`${keyPrefix}${index}`}>
      {createElement(child, mapping, keyPrefix)}
    </React.Fragment>
  ));

  switch (node.type) {
    case NODE_TEXT:
      return node.text;

    case NODE_FRAGMENT:
      return React.createElement(React.Fragment, null, children);

    case NODE_VOID_ELEMENT: {
      const nodeName = node.name;
      const value = mapping[nodeName];

      if (typeof value === "function") {
        return (value as () => React.ReactNode)();
      }

      return value ?? React.createElement(nodeName, null);
    }

    case NODE_TAG_ELEMENT: {
      const nodeName = node.name;
      const value = mapping[nodeName];

      if (value === undefined) {
        return React.createElement(nodeName, null, children);
      }

      if (typeof value === "function") {
        return (value as (children: React.ReactNode) => React.ReactNode)(children);
      }

      if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
        if (React.Children.count(value.props.children) !== 0) {
          throw new Error(
            "when passing an element as value, the element should not contains children",
          );
        }

        return React.cloneElement(value, undefined, children);
      }

      throw new Error(
        `Invalid mapping value for "${nodeName}". Only element or render function are accepted`,
      );
    }

    case NODE_PLACEHOLDER: {
      const nodeName = node.name;
      const value = mapping[nodeName];

      if (value === undefined) {
        console.warn(`missing "${nodeName}" in mapping`);
        return node.string;
      }

      if (typeof value === "function") {
        return (value as () => React.ReactNode)();
      }

      return value;
    }

    default:
      return assertNever(node);
  }
}

const Interpolate = function Interpolate({
  string,
  syntax,
  mapping = {},
  graceful = true,
}: InterpolateProps): React.ReactNode {
  try {
    const tree = parser(string, syntax);
    return createElement(tree, mapping, string);
  } catch (error) {
    if (graceful) {
      console.error(error);
      return string;
    }

    throw error;
  }
};

export default Interpolate;
