import ScaleControl, { type IScaleControlProps } from './ScaleControl';

export type TScoreControlProps = Omit<IScaleControlProps, 'presentation'>;

export default function ScoreControl(props: TScoreControlProps) {
    return <ScaleControl {...props} presentation="score" />;
}
