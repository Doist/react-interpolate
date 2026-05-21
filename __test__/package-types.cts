import pkg = require("@doist/react-interpolate");

import type { ReactNode } from "react";

const mapping: pkg.Mapping = {
  b: (children?: ReactNode) => children ?? null,
  name: "William",
};

const props: pkg.InterpolateProps = {
  string: "<b>{{name}}</b>",
  syntax: pkg.SYNTAX_I18NEXT,
  mapping,
  graceful: true,
};

void pkg.default(props);
void pkg.TOKEN_PLACEHOLDER;
void props;
