import { TestBed } from '@angular/core/testing';

import { PaymentGateway } from './payment-gateway';

describe('PaymentGateway', () => {
  let service: PaymentGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaymentGateway);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
