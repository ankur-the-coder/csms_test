import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainingMaterials } from './training-materials';

describe('TrainingMaterials', () => {
  let component: TrainingMaterials;
  let fixture: ComponentFixture<TrainingMaterials>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingMaterials],
    }).compileComponents();

    fixture = TestBed.createComponent(TrainingMaterials);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
