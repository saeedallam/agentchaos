import { matchesTarget } from './fault-planner.js';

describe('matchesTarget', () => {
  it('matches any path when the target has no path', () => {
    expect(matchesTarget({ tool: 'todos' }, 'todos', '/todos/1')).toBe(true);
  });

  it('does not match a different tool', () => {
    expect(matchesTarget({ tool: 'todos' }, 'email', '/inbox')).toBe(false);
  });

  it('matches an exact path', () => {
    const target = { tool: 'todos', path: '/todos/1' };
    expect(matchesTarget(target, 'todos', '/todos/1')).toBe(true);
  });

  it('does not match a different exact path', () => {
    const target = { tool: 'todos', path: '/todos/1' };
    expect(matchesTarget(target, 'todos', '/todos/2')).toBe(false);
  });

  it('matches a path that starts with a prefix ending in *', () => {
    const target = { tool: 'todos', path: '/todos*' };
    expect(matchesTarget(target, 'todos', '/todos/7')).toBe(true);
  });

  it('does not match a path outside the prefix', () => {
    const target = { tool: 'todos', path: '/todos*' };
    expect(matchesTarget(target, 'todos', '/users/1')).toBe(false);
  });
});
