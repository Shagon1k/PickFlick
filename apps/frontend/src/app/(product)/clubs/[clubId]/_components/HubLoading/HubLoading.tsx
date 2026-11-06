'use client';

import { type ReactNode, use } from 'react';

import AchievementsSkeleton from '#components/achievements/AchievementsSkeleton/AchievementsSkeleton';
import FilmTableSkeleton from '#components/movies/FilmTableSkeleton/FilmTableSkeleton';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import { HubSnapshotContext } from '../HubPanel/HubPanel';
import MembersSkeleton from './MembersSkeleton';
import OverviewSkeleton from './OverviewSkeleton';
import SessionsSkeleton from './SessionsSkeleton';
import SettingsSkeleton from './SettingsSkeleton';

type THubSection =
    | 'overview'
    | 'sessions'
    | 'club-ratings'
    | 'members'
    | 'achievements'
    | 'settings';

export default function HubLoading({ variant, label }: { variant: THubSection; label: string }) {
    const hub = use(HubSnapshotContext);
    const skeletons: Record<THubSection, ReactNode> = {
        overview: <OverviewSkeleton hub={hub} />,
        sessions: <SessionsSkeleton hub={hub} />,
        'club-ratings': <FilmTableSkeleton variant="club-ratings" />,
        members: <MembersSkeleton withRemovals={hub?.members.some((member) => member.canRemove)} />,
        achievements: <AchievementsSkeleton />,
        settings: <SettingsSkeleton hub={hub} />,
    };
    return <LoadingState label={label}>{skeletons[variant]}</LoadingState>;
}
