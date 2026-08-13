import { TestBed } from '@angular/core/testing';

import { LearnerCourseService } from './learner-course.service';

describe('LearnerCourseService', () => {
  let service: LearnerCourseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnerCourseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
