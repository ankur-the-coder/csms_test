import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenewClientdetails } from './renew-clientdetails';

describe('RenewClientdetails', () => {
  let component: RenewClientdetails;
  let fixture: ComponentFixture<RenewClientdetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenewClientdetails],
    }).compileComponents();

    fixture = TestBed.createComponent(RenewClientdetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
