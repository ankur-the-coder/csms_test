import { TestBed } from '@angular/core/testing';

import { FileSanitizerService } from './file-sanitizer-service';

describe('FileSanitizerService', () => {
  let service: FileSanitizerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileSanitizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
