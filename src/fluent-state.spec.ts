import { expect } from 'chai';

import { FluentState } from '.';
import { Lifecycle } from './enums';

describe('fluent-state', () => {
  describe('create states and transitions', () => {
    it('should create a state', () => {
      const fs = new FluentState();
      fs.from('vegetable');
      expect(!!fs._getState('vegetable')).to.equal(true);
    });

    it('current state should be set to first state', () => {
      const fs = new FluentState();
      fs.from('vegetable');
      expect(fs.state.name).to.equal('vegetable');
    });

    it('should create a transition', () => {
      const fs = new FluentState();
      const transition = fs.from('vegetable').to('diced');
      expect(transition.state.can('diced')).to.equal(true);
    });

    it('should create a transition using "or"', () => {
      const fs = new FluentState();
      const transition = fs.from('vegetable').to('diced').or('pickled');
      expect(transition.state.can('pickled')).to.equal(true);
    });

    it('should create multiple transitions chaining "to" and "or"', () => {
      const fs = new FluentState();
      const transition = fs.from('vegetable').to('diced').or('pickled');
      expect(transition.state.can('diced')).to.equal(true);
      expect(transition.state.can('pickled')).to.equal(true);
    });

    it('should not create duplicate transition', () => {
      const fs = new FluentState();
      const transition = fs.from('vegetable').to('diced').or('diced');
      const count = transition.state.transitions.filter(x => x === 'diced').length;
      expect(count).to.equal(1);
    });

    it('should add a transition to an existing state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');
      const transition = fs.from('vegetable').to('pickled');
      expect(transition.state.can('diced')).to.equal(true);
    });
  });

  describe('remove states and transitions', () => {
    it('should remove all states', () => {
      const fs = new FluentState();
      fs.from('vegetable');
      fs.clear();
      expect(!!fs._getState('vegetable')).to.equal(false);
    });

    it('should remove a state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced')
        .from('diced');
      fs.remove('vegetable');
      expect(!!fs._getState('vegetable')).to.equal(false);
      expect(!!fs._getState('diced')).to.equal(true);
    });
  });

  describe('transition', () => {
    it('should transition to the next state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      expect(fs.next()).to.equal(true);
      expect(fs.state.name).to.equal('diced');
    });

    it('should transition to the next random state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced').or('pickled').or('discarded');

      expect(fs.next()).to.equal(true);
      expect(['diced', 'pickled', 'discarded'].includes(fs.state.name)).to.equal(true);
    });

    it('should transition to the next random state (excluding)', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced').or('pickled').or('eaten').or('discarded');

      expect(fs.next('diced', 'pickled')).to.equal(true);
      expect(['eaten', 'discarded'].includes(fs.state.name)).to.equal(true);
    });

    it('should not transition to the next random state when all states have been excluded', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced').or('pickled');

      expect(fs.next('diced', 'pickled')).to.equal(false);
      expect(fs.state.name).to.equal('vegetable');
    });

    it('should transition to a specified state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      expect(fs.transition('diced')).to.equal(true);
    });

    it('should transition to a random specified state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced').or('pickled').or('discarded');

      expect(fs.transition('diced', 'discarded')).to.equal(true);
      expect(['diced', 'discarded'].includes(fs.state.name)).to.equal(true);
    });

    it('transition should change state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');
      fs.transition('diced');
      expect(fs.state.name).to.equal('diced');
    });

    it('should not transition to an invalid state', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      expect(fs.transition('foo')).to.equal(false);
    });
  });

  describe('lifecycle', () => {
    it('should add an observer', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      let result = false;
      fs.observe(Lifecycle.AfterTransition, () => {
        result = true;
      });

      fs.next();

      expect(result).to.equal(true);
    });

    it('should stop transition', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      fs.observe(Lifecycle.BeforeTransition, () => {
        return false;
      });

      fs.transition('diced');

      expect(fs.state.name).to.equal('vegetable');
    });
  });

  describe('callbacks', () => {
    it('should add a callback', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      let result = false;
      fs.when('diced').do(() => {
        result = true;
      });

      fs.transition('diced');

      expect(result).to.equal(true);
    });

    it('should add multiple callbacks', () => {
      const fs = new FluentState();
      fs.from('vegetable').to('diced');

      let result1 = false;
      let result2 = false;
      fs.when('diced')
        .do(() => { result1 = true; })
        .and(() => { result2 = true; });

      fs.transition('diced');

      expect(result1).to.equal(true);
      expect(result2).to.equal(true);
    });
  });
});
