import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditMetaComponent } from './edit-meta.component';

describe('EditMetaComponent', () => {
  let component: EditMetaComponent;
  let fixture: ComponentFixture<EditMetaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EditMetaComponent]
    });
    fixture = TestBed.createComponent(EditMetaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
