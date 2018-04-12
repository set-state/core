const STATE = Symbol('set-state')
const END = Symbol('set-state:end')
const GUARD = Symbol('set-state:guard')
const NODE = Symbol('set-state:node')
const isFunction = x => typeof x === 'function'
const isState = x => isFunction(x) && x.is === STATE
const isNode = x => isFunction(x) && x.is === NODE
const isSealed = x => isNode(x) && x.sealed === GUARD
const isFrozen = x => isNode(x) && x.compute === END
const recompute = node => {
  const prev = node.value
  node.value = node.compute()
  if (prev !== node.value) {
    Array.from(node.listeners).forEach(fn => fn(node.value, prev))
  }
}
const eachDep = (node, method) => {
  Array.from(node.dependencies).forEach(dep => {
    if (method === 'add' && dep.dependencies.has(node)) {
      throw new ReferenceError('circular reference created.')
    }
    dep.dependents[method](node)
  })
}
const update = node => {
  const updating = node.state.updating
  if (updating.has(node)) updating.delete(node)
  updating.add(node)
  Array.from(node.dependents).forEach(update)
}

let count = 0

export default function factory (ctx, fns = []) {
  let isCapturing = false
  const capturing = new Set()
  const updating = new Set()
  const context = ctx || count++
  const plugins = new Set(fns)
  const state = compute => {
    if (isNode(compute)) return compute
    const node = new_compute => {
      if (isCapturing) capturing.add(node)
      if (isFrozen(node) || isSealed(node)) return node.value
      if (new_compute !== undefined) {
        if (new_compute === node.value) return node
        if (new_compute === GUARD) {
          node.sealed = GUARD
          return node
        }
        eachDep(node, 'delete')
        node.dependencies.clear()
        if (new_compute === END) {
          node.compute = END
          return node
        }
        node.compute = () => new_compute
        if (isFunction(new_compute)) {
          node.compute = new_compute
          isCapturing = true
          capturing.clear()
          recompute(node)
          capturing.delete(node)
          node.dependencies = new Set(capturing)
          isCapturing = false
          eachDep(node, 'add')
        } else {
          recompute(node)
        }
        updating.clear()
        Array.from(node.dependents).forEach(update)
        Array.from(updating).forEach(recompute)
      }
      return node.value
    }
    node.locals = {}
    node.state = state
    node.is = NODE
    node.context = context
    node.listeners = new Set()
    node.dependents = new Set()
    node.dependencies = new Set()
    node.on = (obj, method) => {
      const fn = isFunction(obj) ? obj : obj[method].bind(obj)
      node.listeners.add(fn)
      return () => node.listeners.delete(fn)
    }
    node.seal = () => node(GUARD)
    node.freeze = node.end = () => node(END)
    node.valueOf = node.toString = () => node.value
    Array.from(plugins).forEach(plugin => plugin(node))
    node(compute)
    return node
  }
  state.use = plugin => {
    plugins.add(plugin)
    return state
  }
  state.isOwnNode = x => isNode(x) && state.context === x.context
  state.plugins = plugins
  state.updating = updating
  state.capturing = capturing
  state.is = STATE
  state.of = state
  state.END = END
  state.GUARD = GUARD
  state.isNode = isNode
  state.freeze = state.end = a => state(a).end()
  state.seal = a => state(a).seal()
  state.isSealed = isSealed
  state.isFrozen = state.isFinished = isFrozen
  state.context = context
  return state
}

factory.isState = isState
factory.state = factory('set-state:core')

export const state = factory.state
