import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ModalChallengeAcceptanceComponent } from './modal-challenge-acceptance.component';

describe('ModalChallengeAcceptanceComponent', () => {
  let component: ModalChallengeAcceptanceComponent;
  let fixture: ComponentFixture<ModalChallengeAcceptanceComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ModalChallengeAcceptanceComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalChallengeAcceptanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
