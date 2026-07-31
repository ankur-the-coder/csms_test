import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiSelectInput } from './multi-select-input';

describe('MultiSelectInput', () => {
  let component: MultiSelectInput;
  let fixture: ComponentFixture<MultiSelectInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiSelectInput],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiSelectInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
