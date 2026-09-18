import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  removeClubAvatar: vi.fn(),
  submitClubMemberRole: vi.fn(),
  submitClubOperation: vi.fn(),
  submitClubSettings: vi.fn(),
  uploadClubAvatar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../../../components/clubs/club-api", () => api);

import {
  changeClubMemberRoleAction,
  clubLifecycleAction,
  removeClubAvatarAction,
  updateClubSettingsAction,
  uploadClubAvatarAction,
} from "../actions";

const clubId = "10000000-0000-4000-8000-000000000031";
const previous = { message: "", revision: 2, status: "idle" as const };
const unavailable = {
  message: "The Club could not be updated. Nothing unsafe was applied; try again.",
  revision: 3,
  status: "error",
};

function formData(values: Readonly<Record<string, string | File>>): FormData {
  const result = new FormData();
  for (const [name, value] of Object.entries(values)) {
    result.set(name, value);
  }
  return result;
}

describe("Club settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const connector of Object.values(api)) {
      connector.mockRejectedValue(new TypeError("API unavailable"));
    }
  });

  it("returns recoverable state for every mutation transport failure", async () => {
    await expect(updateClubSettingsAction(clubId, previous, formData({
      name: "Midnight Society",
      operationId: crypto.randomUUID(),
      selectionScaleMax: "7",
      selectionScaleMin: "0",
    }))).resolves.toEqual(unavailable);

    await expect(changeClubMemberRoleAction(clubId, crypto.randomUUID(), previous, formData({
      nextRole: "MODERATOR",
      operationId: crypto.randomUUID(),
    }))).resolves.toEqual(unavailable);

    await expect(clubLifecycleAction(clubId, "reactivate", previous, formData({
      operationId: crypto.randomUUID(),
    }))).resolves.toEqual(unavailable);

    await expect(uploadClubAvatarAction(clubId, previous, formData({
      avatar: new File([new Uint8Array([137, 80, 78, 71])], "avatar.png", { type: "image/png" }),
      operationId: crypto.randomUUID(),
    }))).resolves.toEqual(unavailable);

    await expect(removeClubAvatarAction(clubId, previous, formData({
      operationId: crypto.randomUUID(),
    }))).resolves.toEqual(unavailable);
  });
});
