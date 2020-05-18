import { TOKEN_TEXT } from "./constants"
export { SYNTAX_I18NEXT, SYNTAX_BUILT_IN } from "./syntax"

/*
 * return a array of token object
 */
export default function lexer(string, syntax) {
    const matches = []

    for (const rule of syntax) {
        const { type, regex } = rule

        var res
        while ((res = regex.exec(string)) !== null) {
            matches.push({
                type,
                string: res[0],
                name: res[1],
                start: res.index,
                end: res.index + res[0].length
            })
        }
    }

    matches.sort((a, b) => a.start - b.start)
    const textTokens = []

    let start = 0
    matches.forEach(match => {
        if (match.start === start) {
            start = match.end
            return
        }

        const end = match.start
        const text = string.substring(start, end)

        textTokens.push({
            type: TOKEN_TEXT,
            string: text,
            text,
            start,
            end
        })

        start = match.end
    })

    const text = string.substring(start)
    if (text !== "") {
        textTokens.push({
            type: TOKEN_TEXT,
            string: text,
            start,
            end: string.length
        })
    }

    const tokens = []
        .concat(textTokens, matches)
        .sort((a, b) => a.start - b.start)

    return tokens
}
