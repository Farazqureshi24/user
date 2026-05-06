# User Dashboard App

Angular 20 standalone application built to satisfy the `requirement.md` specification for a production-ready user dashboard.

## Setup Commands

Install Angular CLI globally:

```bash
npm install -g @angular/cli
```

Create the project:

```bash
ng new user-dashboard-app --standalone --routing --style=scss --strict --skip-git --package-manager=npm
```

Install dependencies:

```bash
cd user-dashboard-app
npm install
npm install chart.js rxjs
```

Run the application:

```bash
npm start
```

Run unit tests:

```bash
npm test
```

Create a production build:

```bash
npm run build
```

## Delivered Features

- Standalone Angular architecture with strict typing and route-based shell
- RxJS `BehaviorSubject` user state with reactive table and chart updates
- Lazy-loaded `UserFormComponent` modal via dynamic `import()`
- Lazy-loaded Chart.js pie chart via `import('chart.js/auto')`
- Search, pagination, loading state, empty states, and toast messaging
- OnPush change detection, `trackBy`, `takeUntilDestroyed`, and chart cleanup
- Jasmine and Karma tests for `UserService` and `UserDashboardComponent`
