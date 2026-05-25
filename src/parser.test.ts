import { TOKEN_PLACEHOLDER } from "./constants";
import parser from "./parser";
import { createSyntaxRule } from "./syntax";

describe("parser", () => {
  const tests = [
    "hello",
    "{steven}",
    "<br />",
    "<div></div>",
    "hello {steven} from taiwan",
    "hello {steven} from taiwan <br/>",
    "<div>hello</div>",
    "<div>hello {steven}</div>",
    "<div>hello <b>{steven}</b></div>",
    "<div>hello <b>mr {steven} from taiwan</b></div>",
    "<div>hello <b>mr {steven} from taiwan</b><br /></div>",
    "<div>hello</div><b>steven</b>",
  ];

  test.each(tests)("parses %s", (string) => {
    expect(() => {
      parser(string);
    }).not.toThrow();
  });
});

describe("parser: error handling", () => {
  const invalids = [
    "<div>hello",
    "hello<div>",
    "<br>",
    "hello {steven}</div>",
    "<div>hello <b>{steven}</div></b>",
    "<div>hello <b>{steven}</b></b></div>",
  ];

  test.each(invalids)("invalid syntax: %s", (string) => {
    expect(() => {
      parser(string);
    }).toThrow("Syntax error. Please check if each open tag is closed correctly");
  });
});

describe("parser: custom syntax validation", () => {
  test("syntax rules must use global regexes", () => {
    expect(() => {
      parser("hello {name}", [
        {
          type: TOKEN_PLACEHOLDER,
          regex: /{\s*(\w+)\s*}/,
          getName(match) {
            return match[1] ?? "";
          },
        },
      ]);
    }).toThrow("Syntax rule regex must use the global flag");
  });

  test("syntax rules must capture a token name", () => {
    expect(() => {
      parser("hello {name}", [createSyntaxRule(TOKEN_PLACEHOLDER, /{\s*\w+\s*}/g, 1)]);
    }).toThrow("Syntax rule must capture a token name");
  });
});
