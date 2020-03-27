# react-interpolate

[![size](http://img.badgesize.io/https://cdn.jsdelivr.net/gh/Doist/react-interpolate/dist/react-interpolate.min.cjs?compression=gzip)](http://img.badgesize.io/https://cdn.jsdelivr.net/gh/Doist/react-interpolate/dist/react-interpolate.min.cjs?compression=gzip)
[![Actions Status](https://github.com/Doist/react-interpolate/workflows/CI/badge.svg)](https://github.com/Doist/react-interpolate/actions)


A string interpolation component that formats and interpolates a template string in a safe way.

```jsx
import Interpolate from "@doist/react-interpolate"

function Greeting() {
  return <Interpolate
    string="<h1>Hello {name}. Here is <a>your order info</a></h1>"
    mapping={
      a={child => <a href="https://orderinfo.com">{child}</a>)
      name="William"
    }
  />
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

- You can map placeholder and self-closing tag to any [valid element value](https://reactjs.org/docs/react-api.html#isvalidelement)
- For open & close tag, you need to supply a renderer function that defines how the the enclosed children should be rendered.

```jsx
<Interpolate
  string="Hello {name}. Here is <a>your order info</a><hr/>"
  mapping={
    // you can map placholder and self-closing tag to any valid element value
    name="William" 
    hr={<hr className="break"/>}

    // mapping value for open & close tag must be a function
    a={children => <a href="https://orderinfo.com">{children}</a>)
  }
/>
```


#### `graceful` 
A boolean flag indicates how string syntax error or mapping  error should be handled. When true, the raw string value from the prop `string` would be rendered as a fallback in the error scenario. When false, error would be thrown instead. 

Optional. `true` by default.


```jsx
// would render "an invalid string with unclose tag &lt;h1&gt;"
<Interpolate
  graceful
  string="an invalid string with unclose tag <h1>"
/>
```


## Interpolation syntax

Here is interpolation syntax you can use in your `string`.

#### Placeholder

```jsx
"hello {user_name}"
```

Placeholder name should be alphanumeric (`[A-Za-z0-9_]`). Placeholders could be mapped to any valid element value.

#### Open & close tags

```jsx
"Here is <a>your order info</a>"

// tag name could be any alphanumeric string
"Here is <link>your order info</link>"

// you can nest tag and placeholder
"Here is <a><b>you order info {name}</b></a>"
```

Tag name should be alphanumeric (`[A-Za-z0-9_]`). Open & close tag could only be mapped to a renderer function.

```jsx
<Interpolate
  string="Here is <a>your order info</a>"
  mapping={
    a={children => <a href="https://orderinfo.com">{children}</a>)
  }
/>
```

Unclosed tag or incorrect nesting of tag would result in syntax error.

```js
// bad: no close tag
"Here is <a>your order info"

// bad: incorrect tag structure
"Here is <a><b>your order info</a></b>"
```

#### Self closing tag 

```js
"Hello.<br/>Here is your order"
```

Tag name should be alphanumeric (`[A-Za-z0-9_]`). Self closing tags could be mapped to any valid element value.


## Auto tag element creation

When tags are used the string but there are no correponding mapped value, it would by default create the corresponding HTML element by default. 

```jsx
// would render: <h1>Hellow</h1><br/>World
<Interpolate string="<h1>Hello</h1><br/>world"/>
```
