import { TestBed } from '@angular/core/testing';

import { SystemMessenger } from './system-messenger';

describe('SystemMessenger', () => {
  let service: SystemMessenger;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SystemMessenger);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
