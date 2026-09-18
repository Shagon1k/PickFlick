export interface ClubManagementActionState {
  readonly message: string;
  readonly revision: number;
  readonly status: "idle" | "error" | "success";
}

export const initialClubManagementState: ClubManagementActionState = {
  message: "",
  revision: 0,
  status: "idle",
};
