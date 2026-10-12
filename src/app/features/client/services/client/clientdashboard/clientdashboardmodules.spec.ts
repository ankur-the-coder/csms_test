import { TestBed } from '@angular/core/testing';

import { Clientdashboardmodules } from './clientdashboardmodules';

describe('Clientdashboardmodules', () => {
  let service: Clientdashboardmodules;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardmodules);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
