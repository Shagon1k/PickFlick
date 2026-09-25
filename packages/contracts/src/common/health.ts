export type TDependencyName = 'database' | 'objectStorage';

export interface ILivenessReport {
    status: 'alive';
    revision?: string;
}

export interface IDependencyStatus {
    name: TDependencyName;
    status: 'up' | 'down';
}

export interface IReadinessReport {
    status: 'ready' | 'not_ready';
    checks: IDependencyStatus[];
}
