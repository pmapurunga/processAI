import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuesitosManager } from './quesitos-manager';

describe('QuesitosManager', () => {
  let component: QuesitosManager;
  let fixture: ComponentFixture<QuesitosManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuesitosManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuesitosManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
