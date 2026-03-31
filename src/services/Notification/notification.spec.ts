import { TestBed } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { NotificationService } from './notification';

describe('NotificationService', () => {
  let service: NotificationService;
  let platformSpy: jasmine.SpyObj<Platform>;

  beforeEach(() => {
    const platformMock = jasmine.createSpyObj('Platform', ['is']);

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: Platform, useValue: platformMock }
      ]
    });

    service = TestBed.inject(NotificationService);
    platformSpy = TestBed.inject(Platform) as jasmine.SpyObj<Platform>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateUniqueId', () => {
    it('should generate a unique ID', () => {
      const id1 = service.generateUniqueId();
      const id2 = service.generateUniqueId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('number');
      expect(typeof id2).toBe('number');
    });
  });

  describe('checkPermissions', () => {
    it('should return false when not on capacitor platform', async () => {
      platformSpy.is.and.returnValue(false);

      const result = await service.checkPermissions();

      expect(result).toBe(false);
    });
  });
});
