import { TestBed } from '@angular/core/testing';

import { P2p } from './p2p';

describe('P2p', () => {
  let service: P2p;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(P2p);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
