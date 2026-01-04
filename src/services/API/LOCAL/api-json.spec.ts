import { TestBed } from '@angular/core/testing';

import { ApiJSON } from './api-json';

describe('ApiJSON', () => {
  let service: ApiJSON;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApiJSON);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
