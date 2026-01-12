import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentCommentsPage } from './content-comments.page';

describe('ContentCommentsPage', () => {
  let component: ContentCommentsPage;
  let fixture: ComponentFixture<ContentCommentsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContentCommentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
