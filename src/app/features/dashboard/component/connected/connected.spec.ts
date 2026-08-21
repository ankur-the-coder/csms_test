import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Connected } from './connected';

describe('Connected', () => {
  let component: Connected;
  let fixture: ComponentFixture<Connected>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Connected],
    }).compileComponents();

    fixture = TestBed.createComponent(Connected);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
