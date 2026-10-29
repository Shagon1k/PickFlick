import { RATING_SCALE } from '@pickflick/contracts';

import ScaleControl, { type IScaleControlProps } from './ScaleControl';

export type TRatingControlProps = Omit<IScaleControlProps, 'max' | 'min' | 'presentation'>;

/** A 1–10 star rating built on the scale control. */
export default function RatingControl(props: TRatingControlProps) {
    return (
        <ScaleControl
            {...props}
            max={RATING_SCALE.max}
            min={RATING_SCALE.min}
            presentation="rating"
        />
    );
}
