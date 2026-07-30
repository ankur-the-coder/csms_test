import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleInput } from './single-input';

describe('SingleInput', () => {
  let component: SingleInput;
  let fixture: ComponentFixture<SingleInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SingleInput],
    }).compileComponents();

    fixture = TestBed.createComponent(SingleInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
