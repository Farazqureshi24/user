import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ChartData } from 'chart.js';
import { UserService } from '../services/user.service';
import { UserDashboardComponent } from './user-dashboard.component';

class MockChart {
  static instances: MockChart[] = [];

  readonly update = jasmine.createSpy('update');
  readonly destroy = jasmine.createSpy('destroy');

  constructor(
    _element: HTMLCanvasElement,
    readonly config: { data: ChartData<'pie', number[], string> }
  ) {
    MockChart.instances.push(this);
  }

  get data(): ChartData<'pie', number[], string> {
    return this.config.data;
  }

  set data(nextData: ChartData<'pie', number[], string>) {
    this.config.data = nextData;
  }
}

describe('UserDashboardComponent', () => {
  let fixture: ComponentFixture<UserDashboardComponent>;
  let component: UserDashboardComponent;
  let userService: UserService;
  let loadChartSpy: jasmine.Spy;

  beforeEach(async () => {
    MockChart.instances = [];

    await TestBed.configureTestingModule({
      imports: [UserDashboardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserDashboardComponent);
    component = fixture.componentInstance;
    userService = TestBed.inject(UserService);

    loadChartSpy = spyOn<any>(component, 'loadChartJs').and.resolveTo({
      Chart: MockChart as never
    } as never);
  });

  async function renderComponent(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should render table', async () => {
    userService.addUser({
      name: 'Avery Stone',
      email: 'avery@company.com',
      role: 'Admin'
    });

    await renderComponent();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('table')).not.toBeNull();
    expect(element.querySelector('tbody tr')?.textContent).toContain('Avery Stone');
  });

  it('should render chart', async () => {
    await renderComponent();

    expect(loadChartSpy).toHaveBeenCalled();
    expect(MockChart.instances.length).toBe(1);
  });

  it('should update table on add user', async () => {
    await renderComponent();

    userService.addUser({
      name: 'Jordan Blake',
      email: 'jordan@company.com',
      role: 'Editor'
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Jordan Blake');
    expect(rows[0].textContent).toContain('Editor');
  });

  it('should update chart data', async () => {
    await renderComponent();

    userService.addUser({
      name: 'Taylor Fox',
      email: 'taylor@company.com',
      role: 'Viewer'
    });
    userService.addUser({
      name: 'Morgan Lee',
      email: 'morgan@company.com',
      role: 'Viewer'
    });
    userService.addUser({
      name: 'Harper Cole',
      email: 'harper@company.com',
      role: 'Admin'
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const chart = MockChart.instances[0];
    expect(chart.data.datasets[0].data).toEqual([1, 0, 2]);
    expect(chart.update).toHaveBeenCalled();
  });
});
