import { TestBed } from '@angular/core/testing';

import { Implementation } from './implementation';

describe('Implementation', () => {
  let service: Implementation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Implementation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
