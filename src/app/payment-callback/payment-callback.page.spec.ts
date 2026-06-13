import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentCallbackPage } from './payment-callback.page';

describe('PaymentCallbackPage', () => {
  let component: PaymentCallbackPage;
  let fixture: ComponentFixture<PaymentCallbackPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PaymentCallbackPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
