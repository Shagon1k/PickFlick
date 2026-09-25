/** Strips styling escape hatches: UI atoms vary only through their semantic props. */
export type TOmitStyling<TProps, TOmit extends string = never> = Omit<
    TProps,
    'className' | 'classNames' | 'style' | 'styles' | 'vars' | 'unstyled' | TOmit
>;
