import { TestBed } from '@angular/core/testing';

import { Clientdashboard } from './clientdashboard';

describe('Clientdashboard', () => {
  let service: Clientdashboard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboard);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
