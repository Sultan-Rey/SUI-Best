import { TestBed } from '@angular/core/testing';

import { MediaCacheService } from './media-cache-service';

describe('MediaCacheService', () => {
  let service: MediaCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
