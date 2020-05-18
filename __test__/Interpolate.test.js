/* eslint-disable react/display-name */
import React from "react"
import { render } from "@testing-library/react"
import Interpolate, { SYNTAX_I18NEXT } from "../src"

Interpolate.defaultProps = {
    graceful: false
}

const surpressConsole = () => {
    const w = jest.spyOn(console, "warn").mockImplementation()
    const e = jest.spyOn(console, "error").mockImplementation()

    return () => {
        w.mockRestore()
        e.mockRestore()
    }
}

describe("Interpolate", () => {
    function renderTest({ expected, ...props }) {
        const { container } = render(<Interpolate {...props} />)
        expect(container.innerHTML).toEqual(expected)
    }

    test("when no mapping is provide", () => {
        const restore = surpressConsole() // Interpolate will output warning when no mapping is provided

        renderTest({
            string: "<h1>hello <b>{name}</b></h1><br/>. welcome to todoist",
            expected: "<h1>hello <b>{name}</b></h1><br>. welcome to todoist"
        })

        restore()
    })

    test("tag mapping", () =>
        renderTest({
            string: "<h1>hello <b>steven</b></h1>. welcome to todoist",
            mapping: {
                b: child => <i>{child}</i>,
                h1: child => <h2>{child}</h2>
            },
            expected: "<h2>hello <i>steven</i></h2>. welcome to todoist"
        }))

    test("placholder mapping", () =>
        renderTest({
            string: "{greeting} <b>{name}</b>. welcome to todoist",
            mapping: {
                greeting: "hi",
                name: () => <i>steven</i>
            },
            expected: "hi <b><i>steven</i></b>. welcome to todoist"
        }))

    test("void tag mapping", () =>
        renderTest({
            string: "hello <br/>",
            mapping: {
                br: <hr />
            },
            expected: "hello <hr>"
        }))

    test("combination of mapping", () =>
        renderTest({
            string: "<h1>hello <b>{name}</b></h1>.<br/> welcome to todoist",
            mapping: {
                h1: child => <h2>{child}</h2>,
                b: child => <i>{child}</i>,
                name: "steven",
                br: <hr />
            },
            expected: "<h2>hello <i>steven</i></h2>.<hr> welcome to todoist"
        }))

    test("combination of mapping with function component", () => {
        // eslint-disable-next-line
        const Subheader = ({ children }) => {
            return <h2 className="subheader">{children}</h2>
        }

        renderTest({
            string: "<h1>hello <b>{name}</b></h1>.<br/> welcome to todoist",
            mapping: {
                h1: child => <Subheader>{child}</Subheader>,
                b: child => <i>{child}</i>,
                name: "steven",
                br: <hr />
            },
            expected:
                '<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist'
        })
    })

    test("spacing in the void tag and placeholder should be allowed", () =>
        renderTest({
            string: "hello { name }<br /> welcome to todoist",
            mapping: {
                name: "steven",
                br: <hr />
            },
            expected: "hello steven<hr> welcome to todoist"
        }))

    test("the mapping value should be interpolate corrected with proper html escape", () => {
        renderTest({
            string: "hello { name }<br /> welcome to todoist",
            mapping: {
                name: "<script>window.xss = 1</script>",
                br: "<script>window.xss = 1</script>"
            },
            expected:
                "hello &lt;script&gt;window.xss = 1&lt;/script&gt;&lt;script&gt;window.xss = 1&lt;/script&gt; welcome to todoist"
        })

        expect(window.css).toBeUndefined()
    })

    test("when graceful flag is on and string contains syntax error, interpolate should return the original string and should not throw error", () => {
        const restore = surpressConsole()

        renderTest({
            string: "</h1>",
            expected: "&lt;/h1&gt;",
            graceful: true
        })

        restore()
    })

    test("using SYNTAX_I18NEXT", () => {
        renderTest({
            syntax: SYNTAX_I18NEXT,
            string: "<0>hello <b>{{name}}</b></0>.<br/> welcome to todoist",
            mapping: {
                0: child => <h2 className="subheader">{child}</h2>,
                b: child => <i>{child}</i>,
                name: "steven",
                br: <hr />
            },
            expected:
                '<h2 class="subheader">hello <i>steven</i></h2>.<hr> welcome to todoist'
        })
    })
})

describe("Interpolate: error", () => {
    let restore
    beforeAll(() => {
        restore = surpressConsole()
    })
    afterAll(() => {
        restore()
    })

    function renderTest({ props }) {
        return () => {
            expect(() => render(<Interpolate {...props} />)).toThrow()
        }
    }

    test("non-closing tag", renderTest({ string: "<b>" }))

    test(
        "mapping value for tag should always be a function",
        renderTest({
            string: "<h1>hello</h1>. welcome to todoist",
            mapping: { h1: "hi" }
        })
    )
})
