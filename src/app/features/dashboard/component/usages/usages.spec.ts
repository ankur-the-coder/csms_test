import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Usages } from './usages';

describe('Usages', () => {
  let component: Usages;
  let fixture: ComponentFixture<Usages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Usages],
    }).compileComponents();

    fixture = TestBed.createComponent(Usages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
