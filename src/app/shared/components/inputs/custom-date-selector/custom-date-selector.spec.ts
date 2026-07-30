import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomDateSelector } from './custom-date-selector';

describe('CustomDateSelector', () => {
  let component: CustomDateSelector;
  let fixture: ComponentFixture<CustomDateSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomDateSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomDateSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
