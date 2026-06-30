import { TestBed } from '@angular/core/testing';

import { Initialize } from './initialize';

describe('Initialize', () => {
  let service: Initialize;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Initialize);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
