import ScaleControl, { type IScaleControlProps } from './ScaleControl';

export type TRatingControlProps = Omit<IScaleControlProps, 'max' | 'min' | 'presentation'>;

/** A 1–10 star rating built on the scale control. */
export default function RatingControl(props: TRatingControlProps) {
    return <ScaleControl {...props} max={10} min={1} presentation="rating" />;
}
