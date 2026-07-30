import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultipleInput } from './multiple-input';

describe('MultipleInput', () => {
  let component: MultipleInput;
  let fixture: ComponentFixture<MultipleInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultipleInput],
    }).compileComponents();

    fixture = TestBed.createComponent(MultipleInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
