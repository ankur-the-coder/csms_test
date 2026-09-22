import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingRenewal } from './pending-renewal';

describe('PendingRenewal', () => {
  let component: PendingRenewal;
  let fixture: ComponentFixture<PendingRenewal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingRenewal],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingRenewal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
