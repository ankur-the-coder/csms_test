import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthDatePicker } from './month-date-picker';

describe('MonthDatePicker', () => {
  let component: MonthDatePicker;
  let fixture: ComponentFixture<MonthDatePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthDatePicker],
    }).compileComponents();

    fixture = TestBed.createComponent(MonthDatePicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
