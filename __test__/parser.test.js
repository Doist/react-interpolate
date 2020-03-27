import parser from "../src/parser"

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
        "<div>hello</div><b>steven</b>"
    ]

    tests.forEach(string => {
        test(string, () => {
            parser(string)
        })
    })
})

describe("parser: error handling", () => {
    const invalids = [
        "<div>hello",
        "hello<div>",
        "<br>",
        "hello {steven}</div>",
        "<div>hello <b>{steven}</div></b>",
        "<div>hello <b>{steven}</b></b></div>"
    ]

    invalids.forEach(string => {
        test(`invalid syntax: ${string}`, () => {
            expect(() => {
                parser(string)
            }).toThrow()
        })
    })
})
