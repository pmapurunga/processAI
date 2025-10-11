import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MedicalDocuments } from './medical-documents';

describe('MedicalDocuments', () => {
  let component: MedicalDocuments;
  let fixture: ComponentFixture<MedicalDocuments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalDocuments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MedicalDocuments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
