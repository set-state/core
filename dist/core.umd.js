!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):e.core=n()}(this,function(){var e=Symbol("set-state"),n=Symbol("set-state:end"),t=Symbol("set-state:guard"),r=Symbol("set-state:node"),u=function(e){return"function"==typeof e},o=function(e){return u(e)&&e.is===r},i=function(e){return o(e)&&e.sealed===t},a=function(e){return o(e)&&e.compute===n},c=function(e){var n=e.value;e.value=e.compute(),n!==e.value&&Array.from(e.listeners).forEach(function(t){return t(e.value,n)})},f=function(e,n){Array.from(e.dependencies).forEach(function(t){if("add"===n&&t.dependencies.has(e))throw new ReferenceError("circular reference created.");t.dependents[n](e)})},d=function(e){var n=e.state.updating;n.has(e)&&n.delete(e),n.add(e),Array.from(e.dependents).forEach(d)},s=0;function l(l,p){void 0===p&&(p=[]);var m=!1,v=new Set,y=new Set,S=l||s++,h=new Set(p),w=function(e){if(o(e))return e;var s=function(e){if(m&&v.add(s),a(s)||i(s))return s.value;if(void 0!==e){if(e===s.value)return s;if(e===t)return s.sealed=t,s;if(f(s,"delete"),s.dependencies.clear(),e===n)return s.compute=n,s;s.compute=function(){return e},u(e)?(s.compute=e,m=!0,v.clear(),c(s),v.delete(s),s.dependencies=new Set(v),m=!1,f(s,"add")):c(s),y.clear(),Array.from(s.dependents).forEach(d),Array.from(y).forEach(c)}return s.value};return s.locals={},s.state=w,s.is=r,s.context=S,s.listeners=new Set,s.dependents=new Set,s.dependencies=new Set,s.on=function(e,n){var t=u(e)?e:e[n].bind(e);return s.listeners.add(t),function(){return s.listeners.delete(t)}},s.seal=function(){return s(t)},s.freeze=s.end=function(){return s(n)},s.valueOf=s.toString=function(){return s.value},Array.from(h).forEach(function(e){return e(s)}),s(e),s};return w.use=function(e){return h.add(e),w},w.isOwnNode=function(e){return o(e)&&w.context===e.context},w.plugins=h,w.updating=y,w.capturing=v,w.is=e,w.of=w,w.END=n,w.GUARD=t,w.isNode=o,w.freeze=w.end=function(e){return w(e).end()},w.seal=function(e){return w(e).seal()},w.isSealed=i,w.isFrozen=w.isFinished=a,w.context=S,w}return l.isState=function(n){return u(n)&&n.is===e},l.state=l("set-state:core"),l});
//# sourceMappingURL=core.umd.js.map