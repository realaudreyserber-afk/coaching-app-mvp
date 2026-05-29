import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentInput } from './types';
import type { NormalizedProfile } from '@/lib/features/user-profile/snapshot';

// Mock du snapshot — on veut juste observer SI/quand il est appelé.
const { getUserProfileSnapshot } = vi.hoisted(() => ({
  getUserProfileSnapshot: vi.fn(),
}));
vi.mock('@/lib/features/user-profile/snapshot', () => ({ getUserProfileSnapshot }));

import { resolveProfileSnapshot } from './profile-cache';

const fetched = { uid: 'fetched' } as unknown as NormalizedProfile;
const preloaded = { uid: 'preloaded' } as unknown as NormalizedProfile;

function makeInput(extra: Partial<AgentInput> = {}): AgentInput {
  return {
    session_id: 's1',
    uid: 'u1',
    user_message: 'message',
    reason_for_consult: 'test',
    ...extra,
  };
}

describe('resolveProfileSnapshot — anti-N+1', () => {
  beforeEach(() => {
    getUserProfileSnapshot.mockReset();
    getUserProfileSnapshot.mockResolvedValue(fetched);
  });

  it('retourne le profil préchargé SANS refetch (cas nominal superviseur)', async () => {
    const res = await resolveProfileSnapshot(makeInput({ profile: preloaded }));
    expect(res).toBe(preloaded);
    expect(getUserProfileSnapshot).not.toHaveBeenCalled();
  });

  it('fetch en fallback quand profile est absent (appel direct / test)', async () => {
    const res = await resolveProfileSnapshot(makeInput({ uid: 'uX' }));
    expect(res).toBe(fetched);
    expect(getUserProfileSnapshot).toHaveBeenCalledTimes(1);
    expect(getUserProfileSnapshot).toHaveBeenCalledWith('uX');
  });

  it('fetch en fallback quand profile est null (préchargement superviseur en échec)', async () => {
    const res = await resolveProfileSnapshot(makeInput({ uid: 'uY', profile: null }));
    expect(res).toBe(fetched);
    expect(getUserProfileSnapshot).toHaveBeenCalledWith('uY');
  });
});
