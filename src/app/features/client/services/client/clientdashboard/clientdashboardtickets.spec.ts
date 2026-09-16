import { TestBed } from '@angular/core/testing';

import { Clientdashboardtickets } from './clientdashboardtickets';

describe('Clientdashboardtickets', () => {
  let service: Clientdashboardtickets;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardtickets);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
