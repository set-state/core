import test from 'tape'
import factory, { state } from '../dist/core'

test('@set-state/core', t => {
  t.plan(3)
  t.equal(typeof factory, 'function', 'default export is factory')
  t.true(factory.isState(state), 'core state is a named export')
  t.true(state.context, 'set-state:core', 'core state context')
})

test('factory', t => {
  t.plan(1)
  t.equal(typeof factory.isState, 'function', 'implements isState')
})

test('factory()', t => {
  t.plan(4)
  const state0 = factory()
  t.ok(factory.isState(state0), 'creates state')
  t.equal(state0.context, 0, 'default context count starts at 0')
  t.equal(factory().context, 1, 'default context count incements')
  const node = state0()
  t.equal(node.context, state0.context, 'states share context with nodes')
})

test('factory(a)', t => {
  t.plan(1)
  const stateA = factory('a')
  t.equal(stateA.context, 'a', 'exposes the named context')
})

test('state', t => {
  t.plan(17)
  const methods = [
    'use',
    'of',
    'isOwnNode',
    'isNode',
    'freeze',
    'end',
    'isFrozen',
    'isFinished',
    'seal',
    'isSealed'
  ]
  const props = [
    'plugins',
    'capturing',
    'updating',
    'is',
    'END',
    'GUARD',
    'context'
  ]
  methods.forEach(method => {
    t.equal(typeof state[method], 'function', `implements ${method}`)
  })
  props.forEach(prop => {
    t.ok(state[prop], `exposes ${prop}`)
  })
})

test('state(() => node())', t => {
  t.plan(2)
  const a = state.of(0)
  const b = state.of(() => a() + 1)
  t.equal(b(), 1, 'has the correct initial value')
  a(41)
  t.equal(b(), 42, 'updates when dependencies change')
})

test('state(($b = b(), $c = c()) => (a() ? $b : $c))', t => {
  t.plan(4)
  const a = state.of(false)
  const b = state.of(2)
  const c = state.of(3)
  const d = state.of(($b = b(), $c = c()) => (a() ? $b : $c))
  t.equal(d(), 3, 'd has the correct initial value')
  c(4)
  t.equal(d(), 4, 'd updates when c changes')
  a(true)
  t.equal(d(), 2, 'd updates when a changes')
  b(1)
  t.equal(d(), 1, 'd updates when b changes')
})

test('state(() => a() + ab() + ac())', t => {
  t.plan(6)
  const calculate = { count: 0 }
  const a = state.of(2)
  const b = state.of(4)
  const c = state.of(6)
  const ab = state.of(() => a() + b())
  const bc = state.of(() => b() + c())
  const ac = state.of(() => a() + c())
  const abc = state.of(() => {
    calculate.count += 1
    return a() + ab() + ac()
  })
  t.equal(ab(), 6, 'ab has the correct initial value')
  t.equal(ac(), 8, 'ac has the correct initial value')
  t.equal(abc(), 16, 'abc has the correct initial value')
  t.equal(calculate.count, 1, 'abc calculates once on bootstrap')
  abc.on(value => t.equal(value, 19, 'abc only emits once when a changes'))
  a(3)
  t.equal(calculate.count, 2, 'abc only calculates once when a changes')
})

test('state(() => a() + 1)', t => {
  t.plan(2)
  const a = state.of(0)
  const b = state.of(() => a() + 1)
  a.on(() => t.equal(a(), 1), 'fires listeners only once')
  b.on(() => t.equal(b(), 2), 'updates and fires listeners only once')
  a(1)
  a(1)
  a(1)
})

test('state.isNode(node)', t => {
  t.plan(2)
  const node = state()
  t.false(state.isNode({}))
  t.true(state.isNode(node), 'identifies nodes')
})

test('state.isOwnNode(node)', t => {
  t.plan(3)
  const node = state()
  const orphan = factory().of()
  t.false(state.isOwnNode({}))
  t.false(state.isOwnNode(orphan))
  t.true(state.isOwnNode(node), 'identifies nodes with the same context')
})

test('factory(a, [plugin1, plugin2])', t => {
  t.plan(4)
  const plugin1 = node => (node.identity = () => node)
  const plugin2 = node =>
    (node.concat = str => node.state(() => node() + str).seal())
  const stateA = factory('a', [plugin1, plugin2])
  const nodeX = stateA('x')
  t.ok(nodeX.identity, 'plugin methods are added to nodes')
  t.equal(nodeX.identity(), nodeX, 'plugins create a closure with node')
  const nodeXZ = nodeX.concat('z')
  t.equal(nodeXZ(), 'xz')
  nodeX('xy')
  t.equal(nodeXZ(), 'xyz', 'plugins can create projections of state')
})

test('state.use(plugin)', t => {
  t.plan(4)
  const plugin1 = node => (node.identity = () => node)
  const plugin2 = node =>
    (node.concat = str => node.state(() => node() + str).seal())
  const stateA = factory().use(plugin1).use(plugin2)
  const nodeX = stateA('x')
  t.ok(nodeX.identity, 'plugin methods are added to nodes')
  t.equal(nodeX.identity(), nodeX, 'plugins create a closure with node')
  const nodeXZ = nodeX.concat('z')
  t.equal(nodeXZ(), 'xz', 'plugins create a closure with state')
  nodeX('xy')
  t.equal(nodeXZ(), 'xyz', 'plugins can create projections of state')
})

test('state.freeze(value) || state.end(value) || node.end() || node.freeze()', t => {
  t.plan(13)
  const node0 = state(0)
  const fn = () => node0() + 1
  const arr = [
    state.freeze(fn),
    state.end(fn),
    state(fn).end(),
    state(fn).freeze()
  ]

  arr.forEach(y => {
    t.equal(y(), 1)
  })
  node0(2)
  t.equal(node0(), 2)
  arr.forEach(y => {
    t.equal(y(), 1, 'will not update')
  })
  arr.forEach(y => {
    t.equal(y(0), 1, 'can not be changed')
  })
})

test('node', t => {
  t.plan(15)
  const methods = [
    'state',
    'on',
    'seal',
    'freeze',
    'end',
    'valueOf',
    'toString'
  ]
  const props = [
    'is',
    'context',
    'listeners',
    'dependents',
    'dependencies',
    'locals'
  ]
  const node = state.of()
  t.equal(typeof node, 'function', 'is a function')
  t.equal(typeof node(), 'undefined')
  methods.forEach(method => {
    t.equal(typeof node[method], 'function', `implements ${method}`)
  })
  props.forEach(prop => {
    t.ok(node[prop], `exposes ${prop}`)
  })
})

test('node.valueOf() || node.toString()', t => {
  t.plan(2)
  const node = state.of(1)
  node(2)
  t.equal(node.valueOf(), 2, 'node.value')
  t.equal(node + '', '2', 'node.value')
})

test('node.on(obj, methodName)', t => {
  t.plan(8)
  let count = 0
  const node = state.of(0)
  const cancel = node.on(value => t.equal(value, 1))
  t.equal(typeof cancel, 'function')
  t.equal(node(), 0)
  node(1)
  cancel()
  node(2)
  const bound = state.of()
  const obj = {
    value: bound,
    setValue: function (n) {
      count++
      return this.value(n)
    }
  }
  const input = state.of(0)
  input.on(obj, 'setValue')
  t.equal(obj.value(), undefined)
  t.equal(count, 0)
  input(1)
  t.equal(obj.value(), 1)
  t.equal(count, 1)
  input(1)
  t.equal(count, 1)
})

test('node.on(fn)', t => {
  t.plan(7)
  const calculate = { count: 0 }
  const a = state.of(2)
  const b = state.of(4)
  const c = state.of(6)
  const ab = state.of(() => a() + b())
  const bc = state.of(() => b() + c())
  const ac = state.of(() => a() + c())
  const abc = state.of(() => {
    calculate.count += 1
    return a() + ab() + ac()
  })
  // +6 plan
  t.equal(ab(), 6, 'ab has the correct initial value')
  t.equal(ac(), 8, 'ac has the correct initial value')
  t.equal(abc(), 16, 'abc has the correct initial value')
  t.equal(calculate.count, 1, 'abc calculates once on bootstrap')
  abc.on(value => t.equal(value, 19, 'abc only emits once when a changes'))
  a(3)
  t.equal(calculate.count, 2, 'abc only calculates once when a changes')

  // +1 plan
  const obj = state.of()
  const projection = state.of(() => {
    const val = obj()
    return val ? val.a.b.c : val
  })
  projection.on(n => t.equal(n, 'hello'))
  obj({ a: { b: { c: 'hello' } } })
  obj({ a: { b: { c: 'hello', d: 'world' } } })
})

test('node.on((next, prev) => {})', t => {
  t.plan(2)
  const a = state(3)
  a.on((next, prev) => {
    t.equal(next, 2, 'listeners recieve next value as the first argument')
    t.equal(prev, 3, 'listeners recieve previous value as the second argument')
  })
  a(2)
})

test('state(node)', t => {
  t.plan(3)
  const value = {}
  const node = state(value)
  t.equal(state(node), node, 'is stable')
  t.equal(state(node).value, node.value)
  t.equal(node.value, value)
})

test('state.seal(a) || node.seal()', t => {
  t.plan(6)
  const a = state.of(1)
  const b = state.seal(() => a() + 1)
  const c = state.of(() => a() + 2).seal()
  t.equal(b(), 2)
  t.equal(c(), 3)
  b(0)
  c(0)
  t.equal(b(), 2, 'can not be changed')
  t.equal(c(), 3, 'can not be changed')
  a(-1)
  t.equal(b(), 0, 'will continue to update')
  t.equal(c(), 1, 'will continue to update')
})

test('b(() => a() + 1); a(() => b() + 1)', t => {
  t.plan(1)
  const a = state(1)
  const b = state(() => a() + 1)
  t.throws(() => a(() => b() + 1), 'detects (some) circular references')
})
