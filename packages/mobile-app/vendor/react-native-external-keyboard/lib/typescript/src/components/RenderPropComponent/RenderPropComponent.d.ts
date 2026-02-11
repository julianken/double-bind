import { type FunctionComponent, type ReactElement } from 'react';
export type RenderProp = ReactElement | FunctionComponent | (() => ReactElement);
export declare const RenderPropComponent: ({ render }: {
    render: RenderProp;
}) => import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=RenderPropComponent.d.ts.map