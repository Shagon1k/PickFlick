import ScaleControl, { type IScaleControlProps } from './ScaleControl';

const RATING_MIN = 1;
const RATING_MAX = 10;

export type TRatingControlProps = Omit<IScaleControlProps, 'max' | 'min' | 'presentation'>;

/** A 1–10 star rating built on the scale control. */
export default function RatingControl(props: TRatingControlProps) {
    return <ScaleControl {...props} max={RATING_MAX} min={RATING_MIN} presentation="rating" />;
}
