import {
  buildPaginatedSuccess,
  buildSuccess
} from '@/core/shared/utils/build-success.util';

describe('build success helpers', () => {
  it('builds the standard success envelope', () => {
    expect(buildSuccess({ name: 'inventory' }, 'trace-1')).toEqual({
      success: true,
      data: { name: 'inventory' },
      traceId: 'trace-1'
    });
  });

  it('builds the paginated success envelope with total pages', () => {
    expect(
      buildPaginatedSuccess(['a', 'b'], { page: 2, limit: 10, total: 45 }, 'trace-2')
    ).toEqual({
      success: true,
      data: ['a', 'b'],
      pagination: {
        page: 2,
        limit: 10,
        total: 45,
        totalPages: 5
      },
      traceId: 'trace-2'
    });
  });
});
