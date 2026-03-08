import mongoose, { Types } from 'mongoose';

import { CrmContactModel } from '@/modules/crm/models/crm-contact.model';
import { CrmCounterModel } from '@/modules/crm/models/crm-counter.model';
import { CrmOpportunityModel } from '@/modules/crm/models/crm-opportunity.model';
import { CrmService } from '@/modules/crm/services/crm.service';

describe('CrmService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps duplicate contact creation to a stable conflict code', async () => {
    const service = new CrmService({
      record: vi.fn()
    } as never);

    vi.spyOn(CrmContactModel, 'create').mockRejectedValue({
      code: 11000
    });

    await expect(
      service.createContact({
        tenantId: new Types.ObjectId().toString(),
        firstName: 'Ada',
        lastName: 'Lovelace'
      })
    ).rejects.toMatchObject({
      code: 'CRM_CONTACT_ALREADY_EXISTS',
      statusCode: 409
    });
  });

  it('rejects invalid opportunity stage transitions with a stable conflict code', async () => {
    const service = new CrmService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const opportunityId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(CrmOpportunityModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: opportunityId,
        tenantId,
        stage: 'lead',
        isActive: true,
        save: vi.fn(),
        toObject: vi.fn().mockReturnValue({
          _id: opportunityId,
          tenantId,
          title: 'Renewal',
          description: null,
          stage: 'lead',
          amount: null,
          currency: null,
          contactId: null,
          organizationId: null,
          expectedCloseDate: null,
          isActive: true
        })
      })
    } as never);

    await expect(
      service.changeOpportunityStage({
        tenantId: tenantId.toString(),
        opportunityId: opportunityId.toString(),
        stage: 'proposal'
      })
    ).rejects.toMatchObject({
      code: 'CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID',
      statusCode: 409
    });
  });

  it('rejects activity creation without at least one CRM reference', async () => {
    const service = new CrmService({
      record: vi.fn()
    } as never);

    await expect(
      service.createActivity({
        tenantId: new Types.ObjectId().toString(),
        type: 'note',
        note: 'follow-up'
      })
    ).rejects.toMatchObject({
      code: 'CRM_ACTIVITY_REFERENCE_INVALID',
      statusCode: 400
    });
  });

  it('returns counters from persisted snapshot without mutating state', async () => {
    const service = new CrmService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const findOneAndUpdateSpy = vi.spyOn(CrmCounterModel, 'findOneAndUpdate');

    vi.spyOn(CrmCounterModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        tenantId,
        contactsActive: 10,
        organizationsActive: 5,
        opportunitiesOpen: 3,
        opportunitiesWon: 2,
        opportunitiesLost: 1
      })
    } as never);

    const result = await service.getCounters({
      tenantId: tenantId.toString()
    });

    expect(result).toEqual({
      tenantId: tenantId.toString(),
      contactsActive: 10,
      organizationsActive: 5,
      opportunitiesOpen: 3,
      opportunitiesWon: 2,
      opportunitiesLost: 1
    });
    expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
  });

  it('propagates infrastructure errors while validating activity references', async () => {
    const service = new CrmService({
      record: vi.fn()
    } as never);
    const dbError = new Error('db unavailable');

    vi.spyOn(CrmContactModel, 'findOne').mockReturnValue({
      session: vi.fn().mockReturnValue({
        lean: vi.fn().mockRejectedValue(dbError)
      })
    } as never);

    await expect(
      service.createActivity({
        tenantId: new Types.ObjectId().toString(),
        type: 'note',
        note: 'follow-up',
        contactId: new Types.ObjectId().toString()
      })
    ).rejects.toThrow('db unavailable');
  });
});
