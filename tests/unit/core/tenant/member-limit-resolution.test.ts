import { Types } from 'mongoose';

import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantService } from '@/core/tenant/services/tenant.service';

interface TenantServiceMemberLimitAccess {
  assertMemberLimitNotReached: (tenantId: string, session: never) => Promise<void>;
}

function getMemberLimitAccessor(service: TenantService): TenantServiceMemberLimitAccess {
  return service as unknown as TenantServiceMemberLimitAccess;
}

describe('TenantService member limit resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the stricter limit when both the tenant and the plan define a member cap', async () => {
    const tenantId = new Types.ObjectId();
    const authorization = {
      resolvePlan: vi.fn().mockResolvedValue({
        key: 'plan:growth',
        name: 'Growth',
        description: 'Growth',
        rank: 200,
        allowedModuleKeys: ['inventory'],
        featureFlagKeys: ['inventory:base'],
        memberLimit: 25
      })
    };
    const service = new TenantService(undefined as never, undefined as never, authorization as never);

    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: tenantId,
        planId: 'plan:growth',
        memberLimit: 5
      })
    } as never);
    vi.spyOn(MembershipModel, 'countDocuments').mockReturnValue({
      session: vi.fn().mockResolvedValue(5)
    } as never);

    await expect(
      getMemberLimitAccessor(service).assertMemberLimitNotReached(tenantId.toString(), {} as never)
    ).rejects.toMatchObject({
      code: 'TENANT_MEMBER_LIMIT_REACHED',
      statusCode: 409
    });
  });

  it('allows growth up to the plan limit when the tenant does not override it', async () => {
    const tenantId = new Types.ObjectId();
    const authorization = {
      resolvePlan: vi.fn().mockResolvedValue({
        key: 'plan:growth',
        name: 'Growth',
        description: 'Growth',
        rank: 200,
        allowedModuleKeys: ['inventory'],
        featureFlagKeys: ['inventory:base'],
        memberLimit: 25
      })
    };
    const service = new TenantService(undefined as never, undefined as never, authorization as never);

    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: tenantId,
        planId: 'plan:growth',
        memberLimit: null
      })
    } as never);
    vi.spyOn(MembershipModel, 'countDocuments').mockReturnValue({
      session: vi.fn().mockResolvedValue(24)
    } as never);

    await expect(
      getMemberLimitAccessor(service).assertMemberLimitNotReached(tenantId.toString(), {} as never)
    ).resolves.toBeUndefined();
  });
});
