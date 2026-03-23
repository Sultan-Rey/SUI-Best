import { TestBed } from '@angular/core/testing';

import { DailyRewards } from './daily-rewards';

describe('DailyRewards', () => {
  let service: DailyRewards;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DailyRewards);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
