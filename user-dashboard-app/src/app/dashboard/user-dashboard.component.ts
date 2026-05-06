import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Chart, ChartData, ChartTypeRegistry } from 'chart.js';
import {
  BehaviorSubject,
  Subscription,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  shareReplay,
  startWith,
  take,
  tap,
  timer
} from 'rxjs';
import {
  DASHBOARD_LOADING_DELAY_MS,
  DASHBOARD_PAGE_SIZE,
  USER_ROLE_OPTIONS
} from '../core/constants/dashboard.constants';
import { CreateUser, User, UserRole } from '../models/user.model';
import { ToastService } from '../services/toast.service';
import { UserService } from '../services/user.service';
import type { UserFormComponent } from '../user-form/user-form.component';

type RoleSummary = Record<UserRole, number>;
type PieChart = Chart<keyof ChartTypeRegistry, number[], string>;
type ChartModule = typeof import('chart.js/auto');

interface DashboardViewModel {
  readonly hasUsers: boolean;
  readonly hasFilteredResults: boolean;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalItems: number;
  readonly pageStart: number;
  readonly pageEnd: number;
  readonly paginatedUsers: readonly User[];
  readonly roleSummary: RoleSummary;
}

@Component({
  selector: 'app-user-dashboard',
  imports: [AsyncPipe, DatePipe, NgClass, ReactiveFormsModule],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas')
  private readonly chartCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('modalHost', { read: ViewContainerRef })
  private readonly modalHost?: ViewContainerRef;

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly roleOptions = USER_ROLE_OPTIONS;
  protected readonly isLoading = signal(true);
  protected readonly isChartReady = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isModalLoading = signal(false);
  protected readonly chartLoadError = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly currentPageSubject = new BehaviorSubject<number>(1);

  private chartFactory: ChartModule['Chart'] | null = null;
  private chart: PieChart | null = null;
  private latestRoleSummary: RoleSummary = this.emptyRoleSummary();
  private modalComponentRef: ComponentRef<UserFormComponent> | null = null;
  private modalSubscriptions = Subscription.EMPTY;
  private totalPages = 1;

  protected readonly users$ = this.userService.getUsers();

  private readonly searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.getRawValue()),
    debounceTime(150),
    distinctUntilChanged()
  );

  private readonly filteredUsers$ = combineLatest([this.users$, this.searchTerm$]).pipe(
    map(([users, searchTerm]) => this.filterUsers(users, searchTerm)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly roleSummary$ = this.users$.pipe(
    map((users) => {
      const summary = this.emptyRoleSummary();

      for (const user of users) {
        summary[user.role] += 1;
      }

      return summary;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly dashboardViewModel$ = combineLatest([
    this.users$,
    this.filteredUsers$,
    this.currentPageSubject.asObservable(),
    this.roleSummary$
  ]).pipe(
    map(([users, filteredUsers, currentPage, roleSummary]) => {
      const totalItems = filteredUsers.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / DASHBOARD_PAGE_SIZE));
      const safePage = Math.min(currentPage, totalPages);
      const pageStart = totalItems === 0 ? 0 : (safePage - 1) * DASHBOARD_PAGE_SIZE + 1;
      const paginatedUsers = filteredUsers.slice(
        (safePage - 1) * DASHBOARD_PAGE_SIZE,
        safePage * DASHBOARD_PAGE_SIZE
      );

      return {
        hasUsers: users.length > 0,
        hasFilteredResults: totalItems > 0,
        currentPage: safePage,
        totalPages,
        totalItems,
        pageStart,
        pageEnd: pageStart === 0 ? 0 : pageStart + paginatedUsers.length - 1,
        paginatedUsers,
        roleSummary
      } satisfies DashboardViewModel;
    }),
    tap((viewModel) => {
      this.totalPages = viewModel.totalPages;

      if (viewModel.currentPage !== this.currentPageSubject.value) {
        this.currentPageSubject.next(viewModel.currentPage);
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.currentPageSubject.next(1));

    this.roleSummary$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => {
        this.latestRoleSummary = summary;
        this.renderOrUpdateChart(summary);
      });

    combineLatest([this.users$.pipe(take(1)), timer(DASHBOARD_LOADING_DELAY_MS)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.isLoading.set(false));
  }

  ngAfterViewInit(): void {
    void this.initializeChart();
  }

  ngOnDestroy(): void {
    this.modalSubscriptions.unsubscribe();
    this.modalHost?.clear();
    this.chart?.destroy();
    this.chart = null;
  }

  protected trackByUserId(_index: number, user: User): string {
    return user.id;
  }

  protected previousPage(): void {
    this.currentPageSubject.next(Math.max(1, this.currentPageSubject.value - 1));
  }

  protected nextPage(): void {
    this.currentPageSubject.next(Math.min(this.totalPages, this.currentPageSubject.value + 1));
  }

  protected async openAddUserModal(): Promise<void> {
    if (this.isModalOpen() || this.isModalLoading()) {
      return;
    }

    this.isModalOpen.set(true);
    this.isModalLoading.set(true);
    this.cdr.detectChanges();

    try {
      const { UserFormComponent } = await import('../user-form/user-form.component');

      if (!this.isModalOpen()) {
        return;
      }

      this.modalHost?.clear();
      this.modalComponentRef = this.modalHost?.createComponent(UserFormComponent) ?? null;

      if (!this.modalComponentRef) {
        return;
      }

      this.modalSubscriptions.unsubscribe();
      this.modalSubscriptions = new Subscription();
      this.modalSubscriptions.add(
        this.modalComponentRef.instance.submitted.subscribe((user) => this.handleUserCreated(user))
      );
      this.modalSubscriptions.add(
        this.modalComponentRef.instance.closed.subscribe(() => this.closeAddUserModal())
      );
    } catch {
      this.toastService.showError('The add user form could not be loaded.');
      this.closeAddUserModal();
    } finally {
      this.isModalLoading.set(false);
    }
  }

  protected closeAddUserModal(): void {
    this.modalSubscriptions.unsubscribe();
    this.modalSubscriptions = Subscription.EMPTY;
    this.modalHost?.clear();
    this.modalComponentRef = null;
    this.isModalLoading.set(false);
    this.isModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    if (this.isModalOpen()) {
      this.closeAddUserModal();
    }
  }

  protected loadChartJs(): Promise<ChartModule> {
    return import('chart.js/auto');
  }

  private async initializeChart(): Promise<void> {
    try {
      const chartModule = await this.loadChartJs();
      this.chartFactory = chartModule.Chart;
      this.isChartReady.set(true);
      this.renderOrUpdateChart(this.latestRoleSummary);
    } catch {
      this.chartLoadError.set('Chart data is temporarily unavailable.');
    }
  }

  private handleUserCreated(user: CreateUser): void {
    this.userService.addUser(user);
    this.toastService.showSuccess(`${user.name} added to the dashboard.`);
    this.closeAddUserModal();
  }

  private renderOrUpdateChart(summary: RoleSummary): void {
    if (!this.chartFactory || !this.chartCanvas?.nativeElement) {
      return;
    }

    const chartData = this.buildChartData(summary);

    if (this.chart) {
      this.chart.data = chartData;
      this.chart.update();
      return;
    }

    this.chart = new this.chartFactory(this.chartCanvas.nativeElement, {
      type: 'pie',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 420,
          easing: 'easeOutCubic'
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 18,
              boxWidth: 10,
              color: '#383838',
              font: {
                family: 'Manrope, "Segoe UI", sans-serif',
                size: 12
              }
            }
          }
        }
      }
    });
  }

  private buildChartData(summary: RoleSummary): ChartData<'pie', number[], string> {
    return {
      labels: [...USER_ROLE_OPTIONS],
      datasets: [
        {
          data: USER_ROLE_OPTIONS.map((role) => summary[role]),
          backgroundColor: ['#1c4980', '#4f7fb8', '#383838'],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 10
        }
      ]
    };
  }

  private filterUsers(users: readonly User[], searchTerm: string): readonly User[] {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return users;
    }

    return users.filter((user) => {
      const haystack = `${user.name} ${user.email} ${user.role}`.toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }

  private emptyRoleSummary(): RoleSummary {
    return {
      Admin: 0,
      Editor: 0,
      Viewer: 0
    };
  }
}
