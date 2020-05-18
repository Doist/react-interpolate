import React from "react"
import PropTypes from "prop-types"
import parser from "./parser"
import {
    NODE_FRAGMENT,
    NODE_TAG_ELEMENT,
    NODE_VOID_ELEMENT,
    NODE_PLACEHOLDER,
    NODE_TEXT
} from "./constants"

const createElement = (node, mapping, keyPrefix) => {
    const children = node.children.map((c, i) => (
        <React.Fragment key={keyPrefix + i}>
            {createElement(c, mapping, keyPrefix)}
        </React.Fragment>
    ))

    switch (node.type) {
        case NODE_TEXT: {
            return node.text
        }
        case NODE_FRAGMENT: {
            return React.createElement(React.Fragment, null, children)
        }
        case NODE_VOID_ELEMENT: {
            const val = mapping[node.name]
            if (typeof val === "function") {
                return val()
            }

            return val || React.createElement(node.name, null)
        }
        case NODE_TAG_ELEMENT: {
            const val = mapping[node.name]
            if (typeof val === "function") {
                return val(children)
            }

            if (val !== undefined) {
                throw new Error(
                    `tag "${node.name}" should be mapped to a renderer function`
                )
            }

            return React.createElement(node.name, null, children)
        }
        case NODE_PLACEHOLDER: {
            const val = mapping[node.name]
            if (val === undefined) {
                console.warn(`missing "${node.name}" in mapping`)
                return node.string
            }

            if (typeof val === "function") {
                return val()
            }

            return val
        }
        default:
            return
    }
}

export default function Interpolate({
    string,
    syntax,
    mapping = {},
    graceful = true
}) {
    try {
        const tree = parser(string, syntax)
        return createElement(tree, mapping, string)
    } catch (e) {
        if (graceful) {
            console.error(e)
            return string
        } else {
            throw e
        }
    }
}

Interpolate.propTypes = {
    string: PropTypes.string.isRequired,
    mapping: PropTypes.object,
    graceful: PropTypes.bool
}
