import { TestBed } from '@angular/core/testing';

import { FCMService } from './fcmservice';

describe('FCMService', () => {
  let service: FCMService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FCMService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
