import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyTraining } from './my-training';

describe('MyTraining', () => {
  let component: MyTraining;
  let fixture: ComponentFixture<MyTraining>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTraining],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTraining);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
