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

  assert(typeof cjsPackage === "object", "CJS package should be a namespace object");
  assert(typeof cjsPackage.default === "function", "CJS default export should be a function");
  assert(typeof esmPackage.default === "function", "ESM default export should be a function");
  assert(
    cjsPackage.TOKEN_PLACEHOLDER === esmPackage.TOKEN_PLACEHOLDER,
    "Named exports should match",
  );

  const html = renderToStaticMarkup(
    React.createElement(cjsPackage.default, {
      string: "<b>{name}</b>",
      mapping: {
        b: React.createElement("strong"),
        name: "William",
      },
    }),
  );

  assert(html === "<strong>William</strong>", "Built package should render expected HTML");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
