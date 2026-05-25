const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const cjsPackage = require("@doist/react-interpolate");
  const esmPackage = await import("@doist/react-interpolate");
  const props = {
    string: "<b>{name}</b>",
    mapping: {
      b: React.createElement("strong"),
      name: "William",
    },
  };

  assert(typeof cjsPackage === "object", "CJS package should be a namespace object");
  assert(typeof cjsPackage.default === "function", "CJS default export should be a function");
  assert(typeof esmPackage.default === "function", "ESM default export should be a function");
  assert(
    cjsPackage.TOKEN_PLACEHOLDER === esmPackage.TOKEN_PLACEHOLDER,
    "Named exports should match",
  );

  const cjsHtml = renderToStaticMarkup(React.createElement(cjsPackage.default, props));
  const esmHtml = renderToStaticMarkup(React.createElement(esmPackage.default, props));

  assert(cjsHtml === "<strong>William</strong>", "CJS build should render expected HTML");
  assert(esmHtml === "<strong>William</strong>", "ESM build should render expected HTML");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
