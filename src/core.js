const STATE = Symbol('set-state')
const END = Symbol('set-state:end')
const GUARD = Symbol('set-state:guard')
const NODE = Symbol('set-state:node')
/**
 * Report if value is a function.
 * @private
 * @param {*} x
 * @returns {boolean}
 */
const isFunction = x => typeof x === 'function'
/**
 * Report if value is a State function.
 * @private
 * @param {*} x
 * @returns {boolean}
 */
const isState = x => isFunction(x) && x.is === STATE
/**
 * Report if value is a Node function.
 * @private
 * @param {*} x
 * @returns {boolean}
 */
const isNode = x => isFunction(x) && x.is === NODE
/**
 * Report if a Node function is sealed.
 * @private
 * @param {*} x
 * @returns {boolean}
 */
const isSealed = x => isNode(x) && x.sealed === GUARD
/**
 * Report if a Node function is frozen/finished
 * @private
 * @param {*} x
 * @returns {boolean}
 */
const isFrozen = x => isNode(x) && x.compute === END
/**
 * Recompute updates node.value and invokes all listeners on a
 * change in value passing the new and old values as parameters
 * @private
 * @param {function} node
 */
const recompute = node => {
  const prev = node.value
  node.value = node.compute()
  if (prev !== node.value) {
    Array.from(node.listeners).forEach(fn => fn(node.value, prev))
  }
}
/**
 * Adds or removes a node as a dependent to its dependencies.
 * This is responsible for building the graph that will inform
 * node when its dependencies update value.
 * @private
 * @param {function} node
 * @param {string} method
 */
const eachDep = (node, method) => {
  Array.from(node.dependencies).forEach(dep => {
    if (method === 'add' && dep.dependencies.has(node)) {
      throw new ReferenceError('circular reference created.')
    }
    dep.dependents[method](node)
  })
}
/**
 * recursively build a Set of nodes to update
 * @private
 * @function update
 * @param {function} node
 */
const update = node => {
  const updating = node.state.updating
  if (updating.has(node)) updating.delete(node)
  updating.add(node)
  Array.from(node.dependents).forEach(update)
}

/**
 * Ensure unique Factory contexts.
 * @name count
 * @private
 */
let count = 0

/**
 * Factory functions create state functions with the assigned plugins and context
 * @param {*} [ctx] the context, used to differentiate factories and nodes
 * @param {function[]} [fns] iterable of plugin functions
 * @returns {function} state
 */
export default function factory (ctx, fns = []) {
  let isCapturing = false
  const capturing = new Set()
  const updating = new Set()
  const context = ctx || count++
  const plugins = new Set(fns)
  /**
   * @name state
   * @param {*|function} [x]
   * @returns {function} node
   */
  const state = compute => {
    if (isNode(compute)) return compute
    /**
     * Nodes are stateful variables.
     * Nodes hold values or compute functions.
     * Passing a node a parameter will update the node's value or compute function.
     * Invoking a node function without a parameter will return the node's computed value.
     * @name node
     * @param {*|function} [x] function or value
     * @returns {*} node or node.value
     */
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
    /**
     * Used to hold values used by plugins.
     * @property {object}
     */
    node.locals = {}
    /**
     * Reference to the State function that created the node.
     * @property {function}
     */
    node.state = state
    /**
     * Reference to the symbol common to all nodes.
     * @property {symbol}
     */
    node.is = NODE
    /**
     * Context provided by the Factory.
     * @property {*}
     */
    node.context = context
    /**
     * Set of listeners added by node.on().
     * @property {set} node.listeners
     */
    node.listeners = new Set()
    /**
     * Set of nodes using this node as a dependency for compute.
     * @property {set} node.dependents
     */
    node.dependents = new Set()
    /**
     * Set of nodes this node uses in compute.
     * @property {set} node.dependencies
     */
    node.dependencies = new Set()
    /**
     * Adds a listener to node which is invoked on changes to value.
     * @static
     * @param {object|function} obj reacting object or function
     * @param {string} method name of method on obj
     * @returns {function} cancel will delete the listener
     */
    node.on = (obj, method) => {
      const fn = isFunction(obj) ? obj : obj[method].bind(obj)
      node.listeners.add(fn)
      return () => node.listeners.delete(fn)
    }
    /**
     * Seals node from further changes to compute.
     * @static
     * @returns {function} node
     */
    node.seal = () => node(GUARD)
    /**
     * Prevents further updates to node value.
     * Alias of node.end()
     * @static
     * @function freeze
     * @memberof node
     * @returns {function} node
     */
    /**
     * Prevents further updates to node value.
     * Alias of node.freeze().
     * @static
     * @function end
     * @memberof node
     * @returns {function} node
     */
    node.freeze = node.end = () => node(END)
    /**
     * Another way to express node.value.
     * Alias of node.toString().
     * @static
     * @function valueOf
     * @memberof node
     * @returns {*} node.value
     */
    /**
     * Another way to express node.value.
     * Also shows up in console messages next to the 𝑓.
     * Alias of node.valueOf().
     * @static
     * @function toString
     * @memberof node
     * @returns {*} node.value
     */
    node.valueOf = node.toString = () => node.value
    Array.from(plugins).forEach(plugin => plugin(node))
    node(compute)
    return node
  }
  /**
   * Adds a new plugin to the state function.
   * Plugins are invoked when the state function is invoked.
   * @static
   * @param {function} plugin
   * @returns {function} state
   */
  state.use = plugin => {
    plugins.add(plugin)
    return state
  }
  /**
   * Report if a value is a node from the same context as state.
   * @static
   * @param {*|node} [x]
   * @returns {boolean}
   */
  state.isOwnNode = x => isNode(x) && state.context === x.context
  /**
   * Plugins registered to the state.
   * @property {set}
   */
  state.plugins = plugins
  /**
   * Used to track which nodes will udpate.
   * @property {set}
   */
  state.updating = updating
  /**
   * Set of nodes involved in the compute of a node's value.
   * @property {set}
   */
  state.capturing = capturing
  /**
   * The identifying symbol for all State functions.
   * @property {symbol}
   */
  state.is = STATE
  /**
   * Alias of state()
   * @static
   * @function of
   * @memberof state
   * @param {*|function} [x]
   * @returns {function} node
   */
  state.of = state
  /**
   * Passed as a value to remove a node's dependencies and fix it's value.
   * @property {symbol}
   */
  state.END = END
  /**
   * Passed as a value to seal a node's compute.
   * @property {symbol}
   */
  state.GUARD = GUARD
  /**
   * Report if a value is a node function.
   * @static
   * @function isNode
   * @memberof state
   * @param {*|node} [node]
   * @returns {boolean}
   */
  state.isNode = isNode
  /**
   * Create or change a node to not update value.
   * Alias of state.end()
   * @static
   * @function freeze
   * @memberof state
   * @param {*|function|node} [x] function, value, or node to freeze
   * @returns {function} node
   */
  /**
   * Create or change a node to not update value.
   * Alias of state.freeze()
   * @static
   * @function end
   * @memberof state
   * @param {*|function|node} [x] function, value, or node to freeze
   * @returns {function} node
   */
  state.freeze = state.end = x => state(x).end()
  /**
   * Create or change a node to seal a function or value.
   * @static
   * @param {*|node} [x] function, value, or node to seal
   * @returns {function} node (sealed)
   */
  state.seal = x => state(x).seal()
  /**
   * Reports if a value is a sealed node.
   * @static
   * @function isSealed
   * @memberof state
   * @param {*|node} [node]
   * @returns {boolean}
   */
  state.isSealed = isSealed
  /**
   * Report if a value is a frozen/finished node.
   * Alias of state.isFinished().
   * @static
   * @function isFrozen
   * @memberof state
   * @param {*|node} [node]
   * @returns {function} node
   */
  /**
   * Report if a value is a frozen/finished node.
   * Alias of state.isFrozen().
   * @static
   * @function isFinished
   * @memberof state
   * @param {*|node} [node]
   * @returns {function} node
   */
  state.isFrozen = state.isFinished = isFrozen
  /**
   * Inherited from the state function's factory.
   * @property {*} context
   */
  state.context = context
  return state
}

/**
 * Reports if value is a State function.
 * @static
 * @function isState
 * @memberof factory
 * @param {*|state} [state] value to be evaluated
 * @returns {boolean}
 */
factory.isState = isState

/**
 * Default core State function.
 * @static
 * @function state
 * @memberof factory
 * @param {*|function|node} [x] value or function used for node value
 * @returns {function} node
 */
factory.state = factory('set-state:core')

export const state = factory.state
