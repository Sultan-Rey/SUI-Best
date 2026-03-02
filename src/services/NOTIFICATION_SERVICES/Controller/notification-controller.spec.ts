import { TestBed } from '@angular/core/testing';

import { NotificationController } from './notification-controller';

describe('NotificationController', () => {
  let service: NotificationController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
