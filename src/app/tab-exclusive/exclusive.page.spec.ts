import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExclusivePage } from './exclusive.page';

describe('ExclusivePage', () => {
  let component: ExclusivePage;
  let fixture: ComponentFixture<ExclusivePage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ExclusivePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
