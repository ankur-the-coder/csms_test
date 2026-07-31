import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiFileInput } from './multi-file-input';

describe('MultiFileInput', () => {
  let component: MultiFileInput;
  let fixture: ComponentFixture<MultiFileInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiFileInput],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiFileInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
