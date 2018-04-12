# @set-state/core

[![Codestyle Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Standard Version](https://img.shields.io/badge/release-standard%20version-brightgreen.svg)](https://github.com/conventional-changelog/standard-version)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Build Status](https://travis-ci.org/set-state/core.svg?branch=master)](https://travis-ci.org/set-state/core)
[![Coverage Status](https://coveralls.io/repos/github/set-state/core/badge.svg?branch=master)](https://coveralls.io/github/set-state/core?branch=master)

state management in less than 1k

By Paul Grenier (@AutoSponge)

After using Redux, I looked for a simpler approach for some of my work. I also wanted the flexibiliy to manage state at the component level rather than the app level. I wanted to keep the reactive aspects that I liked in Redux, but be able to react to smaller, scoped changes (like a cursor).

[`@set-state`](https://github.com/set-state/core) creates state management systems by synchronously updating dependencies and dependants when state changes. It was heavily inspired by [PureState](https://github.com/MaiaVictor/PureState). `@set-state/core` was designed to provide a minimumly viable API with maximum flexibility for you to create your own types of systems.

## Getting Started

`npm install --save @set-state/core`

## How to use it

We use three main types of functions: [`factory`](#factory), [`state`](#state), and [`node`](#node). Factories create states and states create nodes. Nodes make up the heart of `@set-state` by creating a graph/tree structure and updating themselves effeciently when one of their dependencies change.

Other types of functions, [`plugin`](#plugin), [`listener`](#listener), and [`projection`](#projection), allow you to modify the behavior of nodes and respond to changes in their values with application logic, like rendering.

<!-- js
const factory = require('./dist/core')
const state = factory.state
-->

```js
// Stateful variables are just JS values wrapped with a `state` call.
// Since the resulting function acts like a container, you can use `const`
const x = state(0)

// This reads a stateful variable's current value
x() // => 0

// This writes a stateful variable, changing it's current value
x(1)

// Stateful variables can depend on other stateful variables
const y = state(() => x() + 1)
const z = state(() => [x(), y(), x() + y()])

x() // => 1
y() // => 2
z() // => [1, 2, 3]

// If you change a stateful variable, all variables that depend on it are updated synchronosly.

x(10) // sets x to 10

x() // => 10
y() // => 11
z() // => [10, 11, 21]

// If you use branching logic in a stateful variable, set the dependencies as default parameters to avoid issues with the dependency tree not updating
const a = state(true)
const b = state(2)
const c = state(($b = b()) => a() ? 1 : $b)
a(false)
c() // => 2
a(true)
b(3)
c() // => 1
a(false)
c() // => 3
```

### Factory

Factory functions, like the default export of `core`, can create [`state`](#state) functions that use any number of custom [plugins](#plugin). You can pass a [`factory`](#factory) a `context` which can be used to differentiate [`state`](#state) or [`node`](#node) functions.

```js
// For most applications, you'll only need a single context
// but creating a separate graph (like for a web worker) allows for
// separate graphs to maintain their own synchonous graphs.
const workerState = factory('worker')
workerState.context // => 'worker'
const w1 = workerState(1)
w1() // => 1
w1.context // => 'worker'
workerState.isOwnNode(w1) // => true
state.isOwnNode(w1) // => false
```

```js
factory
/*
{ [Function: factory]
  isState: [Function: isState],   <== fn to identify states
  state:
   { [Function: state]
   ...
   context: 'set-state:core' }}
*/
```

### State

State functions, like the named `state` export of `core`, can create [`node`](#node) functions. By composing states and reacting to changes, you can create sophisticated applications.

```js
state
/*
{ [Function: state]
  use: [Function],        <== add a plugin
  isOwnNode: [Function],  <== compare contexts of a node
  plugins: Set {},        <== list of plugins
  updating: Set {},       <== list of updating nodes
  capturing: Set {},      <== list of recalculating nodes
  is: Symbol(set-state),  <== type identification symbol
  of: [Circular],         <== alias state()
  END: Symbol(set-state:end),       <== symbol passed to end/freeze a node
  GUARD: Symbol(set-state:guard),   <== symbol passed to seal a node
  isNode: [Function: isNode],       <== fn to identify nodes
  end: [Function],                  <== end/freeze a node
  freeze: [Function],               <== end/freeze a node
  seal: [Function],                 <== seal a node
  isSealed: [Function: isSealed],   <== determine if a node is sealed
  isFinished: [Function: isFrozen], <== determine if a node is is frozen
  isFrozen: [Function: isFrozen],   <== alias isFinished
  context: 'set-state:core' }       <== context pass to the factory
*/
```

### Plugin

Factories can also take a list of plugins. Plugins run like middleware when new nodes are created. You can also add individual plugins to a state later with the `.use()` method. Plugins take [`node`](#node) as a parameter. Most plugins will attach functionality to the node (like a serialize method) or create new, dependant nodes called [`projections`](#projection). But you're not limited to those actions.

```js
// Create a JSON serializer.
const isPrimitive = x => Object(x) !== x
const native = x => (x.toJSON === undefined ? x : x.toJSON())
const toJSON = node => {
  node.toJSON = () => isPrimitive(node.value) ? node.value : native(node.value)
}
const serializableState = factory().use(toJSON)
const s1 = serializableState({_id: 1, created: new Date(Date.UTC(2018, 0, 1))})
JSON.stringify(s1) // => '{"_id":1,"created":"2018-01-01T00:00:00.000Z"}'

// Create a projection.
const map = node => node.map = fn => node.state(() => fn(node())).seal()
state.use(map)
const m1 = state(10)
const m2 = m1.map(n => n * n)
m1() // => 10
m2() // => 100
m2(`this won't worked, it's sealed`) // => 100

// Create a plugin that keeps node value types the same.
const setValue = node => {
  node.set = val => {
    if (typeof val === typeof node.value) {
      return node(val)
    }
    // throw new TypeError(...)
  }
}
const typedState = factory('typed', [setValue])
const t1 = typedState(new Date(Date.UTC(2018, 0, 1)))
t1.set(Date.now()) // ignored update since Date.now() is a number
t1().toUTCString() // => 'Mon, 01 Jan 2018 00:00:00 GMT'

// Create a "safe" plugin
const myPlugin = node => {
  // namespace your plugin
  const name = 'myPlugin'
  const state = node.state
  // isolate this plugin's vars
  const vars = node.locals[name] = node.locals[name] || {}
  const pluginFn = () => {/* ...node, state, vars */}
  // check that the plugin's namespace isn't taken
  if (!node[name]) {
    node[name] = pluginFn
  } else {
    // throw new Error(`unable to use plugin: ${name}, namespace in use.`)
  }
}
```

### Node

Nodes have several properties which help them maintain values across a context. You can also use these properties when writing your own plugins.

```js
state(0)
/*
{ [Function: node]         <== this is your new node
  locals: {},              <== this is where you can put variables from plugins
  state:                   <== this is a ref to the state fn that created this node
   { [Function: state]
     ...
     context: 'set-state:core' },
  is: Symbol(set-state:node), <== type identification symbol
  context: 'set-state:core',  <== context will match the state that created it
  listeners: Set {},        <== you can tell if a node has listeners
  dependents: Set {},       <== you can tell if a node has dependents
  dependencies: Set {},     <== you can tell if a node has dependencies
  on: [Function],           <== add a listener
  seal: [Function],         <== seal this node
  end: [Function],          <== freeze/end this node
  freeze: [Function],       <== freeze/end this node
  toString: [Function],     <== convenience fn
  valueOf: [Function],      <== convenience fn
  compute: [Function],      <== value as a fn (compute.toString())
  value: 0 }                <== the raw value (always up-to-date)
*/
```

### Projection

Projections are special nodes. By convention, all projections depend on at least one other node for their value and are "sealed". This means that the function used to calculate their value can not be changed once they are created.

```js
const p0 = state('beep')

// simple projections of p0
const p1 = state.seal(() => `${p0()}!`)
const p2 = state(() => p0().replace(/e/g, 'o')).seal()
const p3 = state(() => `${p0()} ${p2()} ${p1()}` )
p1() // => 'beep!'
p2() // => 'boop'
p3() // => 'beep boop beep!'

// projection using a plugin
const either = node =>
  node.either = (a, b) =>
    node.state(() => // <<< NOTE: use the 'state' from the same context
      a(node()) || b(node())).seal()

state.use(either)
const e0 = state(6)
const e1 = e0.either(n => n % 3, n => n % 2)
e1() // => 0
e0(9)
e1() // => 1

```

### Listener

A listener gets called when a change occurs on the node it is attached to. When called, a listener recieves `nextValue` and `previousValue` as parameters.

```js
const l0 = state('#foo')
const l1 = state('foo')
const link = state((href = l0(), text = l1()) => ({href, text}))
const body = {innerHTML: ''}
const render = ({href, text}) => {
  body.innerHTML = `<a href="${href}">${text}</a>`
}
link.on(render)
// listeners only fire on change
body.innerHTML // => ''
l1('bar')
body.innerHTML // => '<a href="#foo">bar</a>'
```