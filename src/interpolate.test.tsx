/* oxlint-disable react/display-name */
import { render } from "@testing-library/react";
import React from "react";
import Interpolate, { type InterpolateProps } from "./interpolate";
import { SYNTAX_I18NEXT } from "./syntax";

const suppressConsole = () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
};

type RenderSuccessProps = InterpolateProps & {
  expected: string;
};

type RenderErrorProps = InterpolateProps & {
  expectedError: string;
};

describe("Interpolate", () => {
  function renderHtml({ expected: _expected, graceful = false, ...props }: RenderSuccessProps) {
    const { container } = render(<Interpolate {...props} graceful={graceful} />);
    return container.innerHTML;
  }

  test("when no mapping is provide", () => {
    suppressConsole();

    expect(
      renderHtml({
        string: "<h1>hello <b>{name}</b></h1><br/>. welcome to todoist",
        expected: "<h1>hello <b>{name}</b></h1><br>. welcome to todoist",
      }),
    ).toEqual("<h1>hello <b>{name}</b></h1><br>. welcome to todoist");
  });

  test("tag mapping", () =>
    expect(
      renderHtml({
        string: "<h1>hello <b>steven</b></h1>. welcome to todoist",
        mapping: {
          b: (children) => <i>{children}</i>,
          h1: (children) => <h2>{children}</h2>,
        },
        expected: "<h2>hello <i>steven</i></h2>. welcome to todoist",
      }),
    ).toEqual("<h2>hello <i>steven</i></h2>. welcome to todoist"));

  test("tag mapping: should accept element directly", () =>
    expect(
      renderHtml({
        string: "<h1>hello <b>steven</b></h1>. welcome to todoist",
        mapping: {
          b: <i />,
          h1: <h2 />,
        },
        expected: "<h2>hello <i>steven</i></h2>. welcome to todoist",
      }),
    ).toEqual("<h2>hello <i>steven</i></h2>. welcome to todoist"));

  test("placholder mapping", () =>
    expect(
      renderHtml({
        string: "{greeting} <b>{name}</b>. welcome to todoist",
        mapping: {
          greeting: "hi",
          name: () => <i>steven</i>,
        },
        expected: "hi <b><i>steven</i></b>. welcome to todoist",
      }),
    ).toEqual("hi <b><i>steven</i></b>. welcome to todoist"));

  test("void tag mapping", () =>
    expect(
      renderHtml({
        string: "hello <br/>",
        mapping: {
          br: <hr />,
        },
        expected: "hello <hr>",
      }),
    ).toEqual("hello <hr>"));

  test("combination of mapping", () =>
    expect(
      renderHtml({
        string: "<h1>hello <b>{name}</b></h1>.<br/> welcome to todoist",
        mapping: {
          h1: (children) => <h2>{children}</h2>,
          b: (children) => <i>{children}</i>,
          name: "steven",
          br: <hr />,
        },
        expected: "<h2>hello <i>steven</i></h2>.<hr> welcome to todoist",
      }),
    ).toEqual("<h2>hello <i>steven</i></h2>.<hr> welcome to todoist"));

  test("combination of mapping with function component", () => {
    const Subheader = ({ children }: React.PropsWithChildren) => {
      return <h2 className="subheader">{children}</h2>;
    };

    expect(
      renderHtml({
        string: "<h1>hello <b>{name}</b></h1>.<br/> welcome to todoist",
        mapping: {
          h1: (children) => <Subheader>{children}</Subheader>,
          b: (children) => <i>{children}</i>,
          name: "steven",
          br: <hr />,
        },
        expected: '<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist',
      }),
    ).toEqual('<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist');
  });

  test("spacing in the void tag and placeholder should be allowed", () =>
    expect(
      renderHtml({
        string: "hello { name }<br /> welcome to todoist",
        mapping: {
          name: "steven",
          br: <hr />,
        },
        expected: "hello steven<hr> welcome to todoist",
      }),
    ).toEqual("hello steven<hr> welcome to todoist"));

  test("the mapping value should be interpolate corrected with proper html escape", () => {
    expect(
      renderHtml({
        string: "hello { name }<br /> welcome to todoist",
        mapping: {
          name: "<script>window.xss = 1</script>",
          br: "<script>window.xss = 1</script>",
        },
        expected:
          "hello &lt;script&gt;window.xss = 1&lt;/script&gt;&lt;script&gt;window.xss = 1&lt;/script&gt; welcome to todoist",
      }),
    ).toEqual(
      "hello &lt;script&gt;window.xss = 1&lt;/script&gt;&lt;script&gt;window.xss = 1&lt;/script&gt; welcome to todoist",
    );

    expect((window as typeof window & { xss?: number }).xss).toBeUndefined();
  });

  test("when graceful flag is on and string contains syntax error, interpolate should return the original string and should not throw error", () => {
    suppressConsole();

    expect(
      renderHtml({
        string: "</h1>",
        expected: "&lt;/h1&gt;",
        graceful: true,
      }),
    ).toEqual("&lt;/h1&gt;");
  });

  test("using SYNTAX_I18NEXT", () => {
    expect(
      renderHtml({
        syntax: SYNTAX_I18NEXT,
        string: "<0>hello <b>{{name}}</b></0>.<br/> welcome to todoist",
        mapping: {
          0: (children) => <h2 className="subheader">{children}</h2>,
          b: (children) => <i>{children}</i>,
          name: "steven",
          br: <hr />,
        },
        expected: '<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist',
      }),
    ).toEqual('<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist');
  });
});

describe("Interpolate: error cases", () => {
  beforeEach(() => {
    suppressConsole();
  });

  test("non-closing tag", () => {
    const props: RenderErrorProps = {
      string: "<b>",
      expectedError: "Syntax error. Please check if each open tag is closed correctly",
    };

    expect(() => {
      Interpolate({ ...props, graceful: false });
    }).toThrow(props.expectedError);
  });

  test("mapping value for tag should always be a function", () => {
    const props: RenderErrorProps = {
      string: "<h1>hello</h1>. welcome to todoist",
      mapping: { h1: "hi" },
      expectedError: "Invalid mapping value for",
    };

    expect(() => {
      Interpolate({ ...props, graceful: false });
    }).toThrow(props.expectedError);
  });

  test("when passing element as value but the element contains children, error should be thrown", () => {
    const props: RenderErrorProps = {
      string: "<h1>hello</h1>. welcome to todoist",
      mapping: { h1: <h1>hi</h1> },
      expectedError: "when passing an element as value, the element should not contains children",
    };

    expect(() => {
      Interpolate({ ...props, graceful: false });
    }).toThrow(props.expectedError);
  });
});
