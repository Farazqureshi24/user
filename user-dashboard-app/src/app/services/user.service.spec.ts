import { TestBed } from '@angular/core/testing';
import { skip, take } from 'rxjs';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserService);
  });

  it('should initialize empty users', (done) => {
    service.getUsers().pipe(take(1)).subscribe((users) => {
      expect(users).toEqual([]);
      done();
    });
  });

  it('should add user', (done) => {
    service.addUser({
      name: 'Avery Stone',
      email: 'Avery@Company.com',
      role: 'Admin'
    });

    service.getUsers().pipe(take(1)).subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Avery Stone');
      expect(users[0].email).toBe('avery@company.com');
      expect(users[0].role).toBe('Admin');
      done();
    });
  });

  it('should emit updated users', (done) => {
    service.getUsers().pipe(skip(1), take(1)).subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Jordan Blake');
      done();
    });

    service.addUser({
      name: 'Jordan Blake',
      email: 'jordan@company.com',
      role: 'Editor'
    });
  });
});
