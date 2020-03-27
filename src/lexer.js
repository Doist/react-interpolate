import {
    TOKEN_PLACEHOLDER,
    TOKEN_OPEN_TAG,
    TOKEN_CLOSE_TAG,
    TOKEN_SELF_TAG,
    TOKEN_TEXT
} from "./constants"

/*
 * return a array of token object
 */
export default function lexer(string) {
    const regxMap = {
        [TOKEN_PLACEHOLDER]: /{\s*(\w+)\s*}/g,
        [TOKEN_OPEN_TAG]: /<(\w+)>/g,
        [TOKEN_CLOSE_TAG]: /<\/(\w+)>/g,
        [TOKEN_SELF_TAG]: /<(\w+)\s*\/>/g
    }

    const matches = []

    for (const tokenType in regxMap) {
        const regx = regxMap[tokenType]

        var res
        while ((res = regx.exec(string)) !== null) {
            matches.push({
                type: tokenType,
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
