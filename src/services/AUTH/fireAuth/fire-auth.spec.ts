import { TestBed } from '@angular/core/testing';

import { FireAuth } from './fire-auth';

describe('FireAuth', () => {
  let service: FireAuth;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FireAuth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
