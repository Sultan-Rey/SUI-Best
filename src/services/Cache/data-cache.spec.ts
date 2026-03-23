import { TestBed } from '@angular/core/testing';

import { DataCache } from './data-cache';

describe('DataCache', () => {
  let service: DataCache;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataCache);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
