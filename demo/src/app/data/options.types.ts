/**
 * Shape of demo/src/app/data/options.json, the single canonical data source the
 * whole demo app builds itself from (feature grid, install snippets, the Playground's
 * options table + type drill-down, and the Config route's form fields).
 *
 * At release time this same file is copied verbatim to docs/options/<version>.json
 * so the version browser can render a historical version's option set without
 * redeploying the whole app. See RELEASING.md.
 */

export interface Feature {
    title: string;
    description: string;
    /** Key into `examples`, if this feature has a matching Playground example to link to. */
    exampleId?: string;
}

export interface InstallSnippets {
    npm: string;
    /** `{{VERSION}}` is substituted at runtime from the build-time-generated version.json. */
    cdn: string;
}

/** One curated card in the Playground's "Browse examples" section. */
export interface PlaygroundExample {
    id: string;
    title: string;
    description: string;
    /** Full runnable snippet, same shape as the Playground's own code editor content. */
    code: string;
}

/** A row in the Playground's options table or the Config route's form. */
export interface OptionDescriptor {
    name: string;
    /** Display type, e.g. "string", "boolean", "ToastPositionValue". */
    type: string;
    /** Key into `typeSpecs`, if `type` is a complex/linkable type. */
    typeRef?: string;
    default: string;
    description: string;
    /**
     * Exact `ToastBuilder` method-chain fragment appended to the Playground's code
     * snippet when this row is clicked, e.g. `.withColor("#4bb543")`. Rows that share
     * a single builder call (e.g. details/detailsLabel/detailsHideLabel all live on
     * `withDetails(...)`) repeat the same string. Only present on `toastOptions` rows;
     * `configOptions` rows are assembled into a single `configure({...})` object instead.
     */
    builderCall?: string;
    /** Input control the Config route should render for this field. */
    control?: 'text' | 'number' | 'boolean' | 'select' | 'color';
    /** Choices for `control: 'select'`. */
    selectOptions?: string[];
}

/** One member of an object-shaped type spec (e.g. a `ToastTheme` field). */
export interface TypeSpecField {
    name: string;
    type: string;
    default?: string;
    description: string;
}

/** One member of an enum/union-shaped type spec (e.g. a `ToastPositionValue` value). */
export interface TypeSpecValue {
    value: string;
    description: string;
}

export type TypeSpec =
    | { kind: 'enum'; description: string; values: TypeSpecValue[] }
    | { kind: 'object'; description: string; fields: TypeSpecField[] };

export interface OptionsData {
    features: Feature[];
    install: InstallSnippets;
    /** `ToastOptions` fields (+ button-factory helpers), shown in the Playground. */
    toastOptions: OptionDescriptor[];
    /** `ToastsConfig` fields, shown in the Config route. */
    configOptions: OptionDescriptor[];
    typeSpecs: Record<string, TypeSpec>;
    /** Curated cards shown in the Playground's "Browse examples" section. */
    examples: PlaygroundExample[];
}
