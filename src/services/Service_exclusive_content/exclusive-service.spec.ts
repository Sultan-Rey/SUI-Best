import { TestBed } from '@angular/core/testing';

import { ExclusiveService } from './exclusive-service';

describe('ExclusiveService', () => {
  let service: ExclusiveService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExclusiveService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
