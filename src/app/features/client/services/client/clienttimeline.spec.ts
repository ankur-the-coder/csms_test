import { TestBed } from '@angular/core/testing';

import { Clienttimeline } from './clienttimeline';

describe('Clienttimeline', () => {
  let service: Clienttimeline;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Clienttimeline);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
