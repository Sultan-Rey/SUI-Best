import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SecureImageComponent } from './secure-image.component';

describe('SecureImageComponent', () => {
  let component: SecureImageComponent;
  let fixture: ComponentFixture<SecureImageComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [SecureImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SecureImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
