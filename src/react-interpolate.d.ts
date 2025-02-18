export const TOKEN_PLACEHOLDER: 'TOKEN_PLACEHOLDER'

type Syntax = {
    type: typeof TOKEN_PLACEHOLDER
    regex: RegExp
}

type InterpolateProps = {
    string: string
    mapping: {
        [key: string]: ((children: React.ReactNode) => React.ReactNode) | React.ReactNode
    }
    syntax?: Syntax[]
}

declare function Interpolate(props: InterpolateProps): JSX.Element

export = Interpolate
