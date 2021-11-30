# react-interpolate

[![size](http://img.badgesize.io/https://cdn.jsdelivr.net/gh/Doist/react-interpolate/dist/react-interpolate.min.cjs?compression=gzip)](http://img.badgesize.io/https://cdn.jsdelivr.net/gh/Doist/react-interpolate/dist/react-interpolate.min.cjs?compression=gzip) [![Actions Status](https://github.com/Doist/react-interpolate/workflows/CI/badge.svg)](https://github.com/Doist/react-interpolate/actions)

A string interpolation component that formats and interpolates a template string in a safe way.

```jsx
import Interpolate from '@doist/react-interpolate'

function Greeting() {
    return (
        <Interpolate
            string="<h1>Hello {name}. Here is <a>your order info</a></h1>"
            mapping={{
                name: 'William',
                a: <a href="https://orderinfo.com" />,
            }}
        />
    )
}
```

Would render the following HTML

```html
<h1>Hello William. Here is <a href="https://orderinfo.com">your order info</a></h1>
```

## Component API

`<Interpolate>` component accepts the following props

#### `string`

The template string to be interpolated. Required.

Please see the [Interpolation syntax](./#interpolation-syntax) section below for more detail.

#### `mapping`

An object that defines the values to be injected for placeholder and tags defined in the template string. Optional.

-   For placeholder or self-closing tag, the mapping value could be any valid element value
-   For open & close tag, the mapping value could be either renderer function or an element.

```jsx
<Interpolate
    string="Hello {name}. Here is <orderLink>your order info</orderLink><hr/>.  \
            Please contact <supportLink>support</supportLink> for help"
    mapping={{
        // you can map placholder and self-closing tag to any valid element value
        name: 'William',
        hr: <hr className="break" />,

        // you can map open & close tag to a rendering function
        orderLink: (text) => <a href="https://orderinfo.com">{text}</a>,

        // or you can map open & close tag to an element
        supportLink: <a href="https://orderinfo.com" />,
    }}
/>
```

#### `graceful`

A boolean flag indicates how string syntax error or mapping error should be handled. When true, the raw string value from the prop `string` would be rendered as a fallback in the error scenario. When false, error would be thrown instead.

Optional. `true` by default.

```jsx
// would render "an invalid string with unclose tag &lt;h1&gt;"
<Interpolate graceful string="an invalid string with unclose tag <h1>" />
```

#### `syntax`

Optional. `syntax` props allow use of react-Interpolate with different string formatting syntax. Please see the ["Custom syntax support"](#custom-syntax-support) section for more detail.

## Interpolation syntax

Here is interpolation syntax you can use in your `string`.

#### Placeholder

```jsx
'hello {user_name}'
```

Placeholder name should be alphanumeric (`[A-Za-z0-9_]`). Placeholders could be mapped to any valid element value.

#### Open & close tags

```jsx
'Here is <a>your order info</a>'

// tag name could be any alphanumeric string
'Here is <link>your order info</link>'

// you can nest tag and placeholder
'Here is <a><b>you order info {name}</b></a>'
```

Tag name should be alphanumeric (`[A-Za-z0-9_]`).

Open & close tag could be mapped to an element value.

```jsx
<Interpolate
    string="Here is <a>your order info</a>"
    mapping={{
        a: <a href="https://orderinfo.com" />
    }}
/>


// Invalid; the mapping value element should not contain children
<Interpolate
    string="Here is <a>your order info</a>"
    mapping={{
        a: (
            <a href="https://orderinfo.com">
                <b />
                <br />
            </a>
        )
    }}
/>
```

Open & close tag could be mapped to a rendering function, which would take a single argument that contains the enclosing text.

```jsx
<Interpolate
    string="Here is <a>your order info</a>"
    mapping={{
        a: (text) => (
            <a href="https://orderinfo.com">
                <b>{text}</b>
                <br />
            </a>
        ),
    }}
/>
```

Unclosed tag or incorrect nesting of tag would result in syntax error.

```js
// bad: no close tag
'Here is <a>your order info'

// bad: incorrect tag structure
'Here is <a><b>your order info</a></b>'
```

#### Self closing tag

```js
'Hello.<br/>Here is your order'
```

Tag name should be alphanumeric (`[A-Za-z0-9_]`). Self closing tags could be mapped to any valid element value.

## Auto tag element creation

When tags are used the string but there are no correponding mapped value, it would by default create the corresponding HTML element by default.

```jsx
// would render: <h1>Hellow</h1><br/>World
<Interpolate string="<h1>Hello</h1><br/>world" />
```

## Custom syntax support

You may already be using a formatting syntax in your string that is different than the built-in syntax support from Interpolate. You can configure Interpolate so that it could recognize the formatting syntax that you use.

For instance, you may be using [i18next](https://www.i18next.com/) which has a slightly different placeholder syntax.

```
hello {{name}}
```

You can define the formatting syntax of your string via `syntax` props.

```jsx
import Interpolate, { TOKEN_PLACEHOLDER } from "react-interpolate"

const i18nNextSyntax = [
    {
        type: TOKEN_PLACEHOLDER,
        regex: /{{\s*(\w+)\s*}}/g
    }
]

// will output "hi steven"
<Interpolate
    syntax={i18nNextSyntax}
    string="hi {{name}}"
    mapping={{
        name: "steven"
    }}
/>
```

react-interpolate comes with i18next syntax support, and you can enable it via

```jsx
import { SYNTAX_I18NEXT } from "react-interpolate"

<Interpolate
  syntax={SYNTAX_I18NEXT}
  ...
/>
```

# Releasing

A new version of @doist/react-interpolate is published both on npm and GitHub Package Registry whenever a new release on GitHub is created.

To update the version in both `package.json` and `package-lock.json` run:

```sh
npm --no-git-tag-version version <major|minor|patch>
```

Once these changes have been pushed and merged, create a release on GitHub.

A GitHub Action will automatically perform all the necessary steps and will release the version number that's specified inside the `package.json`'s `version` field so make sure that the release tag reflects the version you want to publish.
