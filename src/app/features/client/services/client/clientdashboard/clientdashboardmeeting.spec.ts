import { TestBed } from '@angular/core/testing';

import { Clientdashboardmeeting } from './clientdashboardmeeting';

describe('Clientdashboardmeeting', () => {
  let service: Clientdashboardmeeting;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clientdashboardmeeting);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
