import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Training } from './training';

describe('Training', () => {
  let component: Training;
  let fixture: ComponentFixture<Training>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Training],
    }).compileComponents();

    fixture = TestBed.createComponent(Training);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the single-page dashboard sections', () => {
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Training Center');
    expect(el.textContent).toContain('Upcoming Trainings');
    expect(el.textContent).toContain("Today's Trainings");
    expect(el.textContent).toContain('Training History');
    expect(el.querySelector('app-trainer')).toBeNull();
  });

  it('should open create training modal', () => {
    component.openCreateModal();
    fixture.detectChanges();

    expect(component.isCreateModalOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Create Training');
  });
});
