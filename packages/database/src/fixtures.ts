export const SYNTHETIC_FIXTURES = {
  users: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@example.invalid",
      displayName: "Avery Admin",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "member@example.invalid",
      displayName: "Morgan Member",
    },
  ],
  club: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Synthetic Screening Club",
  },
  memberships: {
    admin: "20000000-0000-4000-8000-000000000001",
    member: "20000000-0000-4000-8000-000000000002",
  },
  pastSession: {
    id: "30000000-0000-4000-8000-000000000001",
    topic: "Synthetic fixture — safe to replace",
  },
} as const;
