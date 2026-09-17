import { TestBed } from '@angular/core/testing';

import { Clientdashboardaddons } from './clientdashboardaddons';

describe('Clientdashboardaddons', () => {
  let service: Clientdashboardaddons;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardaddons);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
