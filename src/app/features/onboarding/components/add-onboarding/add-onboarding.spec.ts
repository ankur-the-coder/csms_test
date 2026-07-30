import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddOnboarding } from './add-onboarding';

describe('AddOnboarding', () => {
  let component: AddOnboarding;
  let fixture: ComponentFixture<AddOnboarding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddOnboarding],
    }).compileComponents();

    fixture = TestBed.createComponent(AddOnboarding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
