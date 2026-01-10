import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentDetailPage } from './content-detail.page';

describe('ContentDetailPage', () => {
  let component: ContentDetailPage;
  let fixture: ComponentFixture<ContentDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContentDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
