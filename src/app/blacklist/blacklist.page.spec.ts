import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlacklistPage } from './blacklist.page';

describe('BlacklistPage', () => {
  let component: BlacklistPage;
  let fixture: ComponentFixture<BlacklistPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BlacklistPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
