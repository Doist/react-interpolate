import Interpolate, {
  SYNTAX_I18NEXT,
  TOKEN_PLACEHOLDER,
  type InterpolateProps,
  type Mapping,
} from "@doist/react-interpolate";
import type { ReactNode } from "react";

const mapping: Mapping = {
  b: (children?: ReactNode) => children ?? null,
  name: "William",
};

const props: InterpolateProps = {
  string: "<b>{{name}}</b>",
  syntax: SYNTAX_I18NEXT,
  mapping,
  graceful: true,
};

void Interpolate(props);
void TOKEN_PLACEHOLDER;
void props;
