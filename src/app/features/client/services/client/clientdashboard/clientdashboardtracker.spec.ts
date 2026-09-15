import { TestBed } from '@angular/core/testing';

import { Clientdashboardtracker } from './clientdashboardtracker';

describe('Clientdashboardtracker', () => {
  let service: Clientdashboardtracker;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardtracker);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
