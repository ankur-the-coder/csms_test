import { TestBed } from '@angular/core/testing';

import { Clientdashboardusage } from './clientdashboardusage';

describe('Clientdashboardusage', () => {
  let service: Clientdashboardusage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardusage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
